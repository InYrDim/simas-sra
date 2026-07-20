import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after } from "node:test";

import mysql from "mysql2/promise";

import { closeDatabasePool } from "@/db";
import { createGetSchoolProfileQuery, createUpdateSchoolProfileCommand } from "@/lib/school-profile";
import { schoolProfileStore } from "@/lib/school-profile-data";
import type { MasterDataPrincipal } from "@/lib/tenant-master-data-access";

const databaseUrl = process.env.DATABASE_URL;
const mysqlTest = databaseUrl ? test : test.skip;
after(() => closeDatabasePool());

async function fixture() {
  const connection = await mysql.createConnection(databaseUrl!);
  const tenantId = randomUUID();
  const ownerId = randomUUID();
  const providerId = randomUUID();
  const bindingId = randomUUID();
  const applicationId = randomUUID();
  const npsn = String(Math.floor(10_000_000 + Math.random() * 90_000_000));
  const domain = `profile-${randomUUID()}`;
  await connection.execute("INSERT INTO `user` (`id`,`name`,`email`,`email_verified`,`created_at`,`updated_at`) VALUES (?, 'Admin', ?, false, NOW(3), NOW(3)), (?, 'Provider', ?, false, NOW(3), NOW(3))", [ownerId, `${ownerId}@example.test`, providerId, `${providerId}@example.test`]);
  await connection.execute("INSERT INTO `provider_admin` (`user_id`,`created_at`) VALUES (?, NOW(3))", [providerId]);
  await connection.execute("INSERT INTO `applicant_school_binding` (`id`,`user_id`,`canonical_npsn`,`created_at`) VALUES (?, ?, ?, NOW(3))", [bindingId, ownerId, npsn]);
  await connection.execute("INSERT INTO `simas_application` (`id`,`school_name`,`npsn`,`education_level`,`address`,`contact_name`,`contact_position`,`contact_email`,`contact_whatsapp`,`status`,`submitted_at`,`owner_user_id`,`binding_id`,`attempt_number`,`idempotency_key`,`payload_hash`) VALUES (?, 'SMA Integrasi', ?, 'SMA', 'Alamat lama', 'Kontak', 'Operator', ?, '081234567890', 'pending', NOW(3), ?, ?, 1, ?, REPEAT('a',64))", [applicationId, npsn, `${applicationId}@example.test`, ownerId, bindingId, randomUUID()]);
  await connection.execute("INSERT INTO `tenant` (`id`,`name`,`domain`,`npsn`,`source_application_id`,`approved_at`,`operational_status`,`created_at`,`updated_at`) VALUES (?, 'SMA Integrasi', ?, ?, ?, NOW(3), 'active', NOW(3), NOW(3))", [tenantId, domain, npsn, applicationId]);
  await connection.execute("UPDATE `simas_application` SET `status`='approved', `decided_at`=NOW(3), `decided_by_provider_admin_id`=?, `approved_tenant_id`=? WHERE `id`=?", [providerId, tenantId, applicationId]);
  await connection.execute("UPDATE `user` SET `tenant_id`=?, `tenant_role`='school-admin' WHERE `id`=?", [tenantId, ownerId]);
  const principal: MasterDataPrincipal = { userId: ownerId, tenantId, role: "school-admin", capabilities: { read: true, write: true, downloadTemplate: true } };
  return { connection, tenantId, ownerId, providerId, applicationId, bindingId, principal };
}

async function cleanup(data: Awaited<ReturnType<typeof fixture>>) {
  try {
    await data.connection.execute("SET FOREIGN_KEY_CHECKS = 0");
    await data.connection.execute("DELETE FROM `school_profile_audit` WHERE `tenant_id`=?", [data.tenantId]);
    await data.connection.execute("DELETE FROM `school_profile` WHERE `tenant_id`=?", [data.tenantId]);
    await data.connection.execute("UPDATE `user` SET `tenant_id`=NULL, `tenant_role`=NULL WHERE `id`=?", [data.ownerId]);
    await data.connection.execute("DELETE FROM `tenant` WHERE `id`=?", [data.tenantId]);
    await data.connection.execute("DELETE FROM `simas_application` WHERE `id`=?", [data.applicationId]);
    await data.connection.execute("DELETE FROM `applicant_school_binding` WHERE `id`=?", [data.bindingId]);
    await data.connection.execute("DELETE FROM `provider_admin` WHERE `user_id`=?", [data.providerId]);
    await data.connection.execute("DELETE FROM `user` WHERE `id` IN (?,?)", [data.ownerId, data.providerId]);
    await data.connection.execute("SET FOREIGN_KEY_CHECKS = 1");
  } finally { await data.connection.end(); }
}

const input = {
  version: 1, displayName: "SMA Integrasi Operasional",
  address: { street: "Jl. Uji 1", village: "Desa", district: "Kecamatan", city: "Bandung", province: "Jawa Barat", postalCode: "40111" },
  institutionalEmail: "info@integrasi.sch.id", institutionalPhone: "+62 22 123456",
  website: "https://integrasi.sch.id", latitude: -6.9, longitude: 107.6, description: "Profil integrasi.",
};

mysqlTest("MySQL keeps lazy creation unique and enforces Tenant-scoped optimistic updates", async () => {
  const data = await fixture();
  try {
    const query = createGetSchoolProfileQuery({ store: schoolProfileStore });
    const [one, two] = await Promise.all([query(data.principal), query(data.principal)]);
    assert.equal(one.ok, true);
    assert.equal(two.ok, true);
    const [rows] = await data.connection.execute<mysql.RowDataPacket[]>("SELECT `version` FROM `school_profile` WHERE `tenant_id`=?", [data.tenantId]);
    assert.equal(rows.length, 1);

    const update = createUpdateSchoolProfileCommand({ store: schoolProfileStore });
    assert.equal((await update(data.principal, input)).ok, true);
    assert.deepEqual(await update(data.principal, { ...input, displayName: "Stale" }), { ok: false, code: "conflict", input: { ...input, displayName: "Stale" } });

    const otherPrincipal = { ...data.principal, tenantId: randomUUID() };
    assert.deepEqual(await query(otherPrincipal), { ok: false, code: "not-found" });
    const [persisted] = await data.connection.execute<mysql.RowDataPacket[]>("SELECT `display_name`,`version` FROM `school_profile` WHERE `tenant_id`=?", [data.tenantId]);
    assert.deepEqual({ displayName: persisted[0].display_name, version: persisted[0].version }, { displayName: "SMA Integrasi Operasional", version: 2 });
  } finally { await cleanup(data); }
});

mysqlTest("MySQL rolls back the profile update when its audit insert fails", async () => {
  const data = await fixture();
  try {
    await createGetSchoolProfileQuery({ store: schoolProfileStore })(data.principal);
    const invalidActor = { ...data.principal, userId: randomUUID() };
    await assert.rejects(createUpdateSchoolProfileCommand({ store: schoolProfileStore })(invalidActor, input));
    const [profiles] = await data.connection.execute<mysql.RowDataPacket[]>("SELECT `display_name`,`version` FROM `school_profile` WHERE `tenant_id`=?", [data.tenantId]);
    const [audits] = await data.connection.execute<mysql.RowDataPacket[]>("SELECT `id` FROM `school_profile_audit` WHERE `tenant_id`=?", [data.tenantId]);
    assert.deepEqual({ displayName: profiles[0].display_name, version: profiles[0].version }, { displayName: "SMA Integrasi", version: 1 });
    assert.equal(audits.length, 0);
  } finally { await cleanup(data); }
});
