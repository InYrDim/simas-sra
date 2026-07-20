import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after } from "node:test";
import mysql from "mysql2/promise";

import { closeDatabasePool } from "@/db";
import { createSubjectCatalogService } from "@/lib/subject-catalog";
import { subjectCatalogStore } from "@/lib/subject-catalog-data";
import type { MasterDataPrincipal } from "@/lib/tenant-master-data-access";

const databaseUrl = process.env.DATABASE_URL;
const mysqlTest = databaseUrl ? test : test.skip;
after(async () => closeDatabasePool());

mysqlTest("MySQL enforces Tenant-scoped reserved uniqueness, ownership, audit, and optimistic writes", async () => {
  const connection = await mysql.createConnection(databaseUrl!);
  const ids = { provider: randomUUID(), tenantA: randomUUID(), tenantB: randomUUID(), adminA: randomUUID(), adminB: randomUUID(), bindingA: randomUUID(), bindingB: randomUUID(), applicationA: randomUUID(), applicationB: randomUUID() };
  const npsnA = String(Math.floor(10_000_000 + Math.random() * 40_000_000));
  const npsnB = String(Math.floor(50_000_000 + Math.random() * 40_000_000));
  const domainA = `subject-a-${randomUUID()}`;
  const domainB = `subject-b-${randomUUID()}`;
  try {
    await connection.execute("INSERT INTO `user` (`id`,`name`,`email`,`email_verified`,`created_at`,`updated_at`) VALUES (?, 'Provider', ?, false, NOW(3), NOW(3)), (?, 'Admin A', ?, false, NOW(3), NOW(3)), (?, 'Admin B', ?, false, NOW(3), NOW(3))", [ids.provider, `${ids.provider}@test.invalid`, ids.adminA, `${ids.adminA}@test.invalid`, ids.adminB, `${ids.adminB}@test.invalid`]);
    await connection.execute("INSERT INTO `provider_admin` (`user_id`,`created_at`) VALUES (?, NOW(3))", [ids.provider]);
    await connection.execute("INSERT INTO `applicant_school_binding` (`id`,`user_id`,`canonical_npsn`,`created_at`) VALUES (?, ?, ?, NOW(3)), (?, ?, ?, NOW(3))", [ids.bindingA, ids.adminA, npsnA, ids.bindingB, ids.adminB, npsnB]);
    const applicationSql = "INSERT INTO `simas_application` (`id`,`school_name`,`npsn`,`education_level`,`address`,`contact_name`,`contact_position`,`contact_email`,`contact_whatsapp`,`status`,`submitted_at`,`owner_user_id`,`binding_id`,`attempt_number`,`idempotency_key`,`payload_hash`) VALUES (?, ?, ?, 'SMA', 'Alamat', 'Kontak', 'Operator', ?, '0812', 'pending', NOW(3), ?, ?, 1, ?, REPEAT('a',64))";
    await connection.execute(applicationSql, [ids.applicationA, "Sekolah A", npsnA, `${ids.applicationA}@test.invalid`, ids.adminA, ids.bindingA, randomUUID()]);
    await connection.execute(applicationSql, [ids.applicationB, "Sekolah B", npsnB, `${ids.applicationB}@test.invalid`, ids.adminB, ids.bindingB, randomUUID()]);
    await connection.execute("INSERT INTO `tenant` (`id`,`name`,`domain`,`npsn`,`source_application_id`,`approved_at`,`operational_status`,`created_at`,`updated_at`) VALUES (?, 'Sekolah A', ?, ?, ?, NOW(3), 'active', NOW(3), NOW(3)), (?, 'Sekolah B', ?, ?, ?, NOW(3), 'active', NOW(3), NOW(3))", [ids.tenantA, domainA, npsnA, ids.applicationA, ids.tenantB, domainB, npsnB, ids.applicationB]);
    await connection.execute("UPDATE `simas_application` SET `status`='approved',`decided_at`=NOW(3),`decided_by_provider_admin_id`=?,`approved_tenant_id`=? WHERE `id`=?", [ids.provider, ids.tenantA, ids.applicationA]);
    await connection.execute("UPDATE `simas_application` SET `status`='approved',`decided_at`=NOW(3),`decided_by_provider_admin_id`=?,`approved_tenant_id`=? WHERE `id`=?", [ids.provider, ids.tenantB, ids.applicationB]);
    await connection.execute("UPDATE `user` SET `tenant_id`=?,`tenant_role`='school-admin' WHERE `id`=?", [ids.tenantA, ids.adminA]);
    await connection.execute("UPDATE `user` SET `tenant_id`=?,`tenant_role`='school-admin' WHERE `id`=?", [ids.tenantB, ids.adminB]);

    const principalA: MasterDataPrincipal = { userId: ids.adminA, tenantId: ids.tenantA, role: "school-admin", capabilities: { read: true, write: true, downloadTemplate: true } };
    const principalB: MasterDataPrincipal = { userId: ids.adminB, tenantId: ids.tenantB, role: "school-admin", capabilities: { read: true, write: true, downloadTemplate: true } };
    const catalog = createSubjectCatalogService({ store: subjectCatalogStore });
    const input = { code: "MAT-01", name: "Matematika", educationLevels: ["SMA"], description: null };
    const createdA = await catalog.create(principalA, input);
    const createdB = await catalog.create(principalB, input);
    assert.equal(createdA.ok, true);
    assert.equal(createdB.ok, true);
    if (!createdA.ok) return;
    assert.equal((await catalog.archive(principalA, createdA.subject.id, 1)).ok, true);
    assert.deepEqual(await catalog.create(principalA, { ...input, name: "Nama lain" }), { ok: false, code: "duplicate-code" });
    assert.deepEqual(await catalog.archive(principalB, createdA.subject.id, 1), { ok: false, code: "not-found" });
    assert.deepEqual(await catalog.edit(principalA, createdA.subject.id, { ...input, code: "MAT-02" }, 1), { ok: false, code: "conflict" });
    const [auditRows] = await connection.query<mysql.RowDataPacket[]>("SELECT `operation`,`from_version`,`to_version` FROM `subject_history` WHERE `tenant_id`=? AND `subject_id`=? ORDER BY `occurred_at`", [ids.tenantA, createdA.subject.id]);
    assert.deepEqual(auditRows.map((row) => [row.operation, row.from_version, row.to_version]), [["created", 0, 1], ["archived", 1, 2]]);
    await assert.rejects(connection.execute("INSERT INTO `subject_history` (`id`,`tenant_id`,`subject_id`,`actor_user_id`,`operation`,`from_version`,`to_version`,`occurred_at`) VALUES (?, ?, ?, ?, 'edited', 2, 3, NOW(3))", [randomUUID(), ids.tenantB, createdA.subject.id, ids.adminB]));
  } finally {
    await connection.execute("DELETE FROM `subject_history` WHERE `tenant_id` IN (?, ?)", [ids.tenantA, ids.tenantB]).catch(() => undefined);
    await connection.execute("DELETE FROM `subject` WHERE `tenant_id` IN (?, ?)", [ids.tenantA, ids.tenantB]).catch(() => undefined);
    await connection.execute("DELETE FROM `tenant` WHERE `id` IN (?, ?)", [ids.tenantA, ids.tenantB]).catch(() => undefined);
    await connection.execute("DELETE FROM `simas_application` WHERE `id` IN (?, ?)", [ids.applicationA, ids.applicationB]).catch(() => undefined);
    await connection.execute("DELETE FROM `applicant_school_binding` WHERE `id` IN (?, ?)", [ids.bindingA, ids.bindingB]).catch(() => undefined);
    await connection.execute("DELETE FROM `provider_admin` WHERE `user_id`=?", [ids.provider]).catch(() => undefined);
    await connection.execute("DELETE FROM `user` WHERE `id` IN (?, ?, ?)", [ids.provider, ids.adminA, ids.adminB]).catch(() => undefined);
    await connection.end();
  }
});
