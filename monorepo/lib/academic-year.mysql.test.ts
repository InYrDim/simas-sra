import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after } from "node:test";
import mysql from "mysql2/promise";

import { closeDatabasePool } from "@/db";
import { createAcademicYearService } from "@/lib/academic-year";
import { academicYearStore } from "@/lib/academic-year-data";
import type { MasterDataPrincipal } from "@/lib/tenant-master-data-access";

const databaseUrl = process.env.DATABASE_URL;
const mysqlTest = databaseUrl ? test : test.skip;
after(() => closeDatabasePool());
const input = (label: string, year: number) => ({ label, startDate: `${year}-07-01`, endDate: `${year + 1}-06-30`, oddStartDate: `${year}-07-01`, oddEndDate: `${year}-12-31`, evenStartDate: `${year + 1}-01-01`, evenEndDate: `${year + 1}-06-30` });

mysqlTest("MySQL serializes concurrent activation to one active Tahun Ajaran and Semester per Tenant", async () => {
  const connection = await mysql.createConnection(databaseUrl!);
  const ids = { tenant: randomUUID(), owner: randomUUID(), provider: randomUUID(), binding: randomUUID(), application: randomUUID() };
  const npsn = String(Math.floor(10_000_000 + Math.random() * 90_000_000));
  try {
    await connection.execute("INSERT INTO `user` (`id`,`name`,`email`,`email_verified`,`created_at`,`updated_at`) VALUES (?, 'Admin', ?, false, NOW(3), NOW(3)), (?, 'Provider', ?, false, NOW(3), NOW(3))", [ids.owner, `${ids.owner}@test.invalid`, ids.provider, `${ids.provider}@test.invalid`]);
    await connection.execute("INSERT INTO `provider_admin` (`user_id`,`created_at`) VALUES (?, NOW(3))", [ids.provider]);
    await connection.execute("INSERT INTO `applicant_school_binding` (`id`,`user_id`,`canonical_npsn`,`created_at`) VALUES (?, ?, ?, NOW(3))", [ids.binding, ids.owner, npsn]);
    await connection.execute("INSERT INTO `simas_application` (`id`,`school_name`,`npsn`,`education_level`,`address`,`contact_name`,`contact_position`,`contact_email`,`contact_whatsapp`,`status`,`submitted_at`,`owner_user_id`,`binding_id`,`attempt_number`,`idempotency_key`,`payload_hash`) VALUES (?, 'Sekolah Uji', ?, 'SMA', 'Alamat', 'Kontak', 'Operator', ?, '0812', 'pending', NOW(3), ?, ?, 1, ?, REPEAT('a',64))", [ids.application, npsn, `${ids.application}@test.invalid`, ids.owner, ids.binding, randomUUID()]);
    await connection.execute("INSERT INTO `tenant` (`id`,`name`,`domain`,`npsn`,`source_application_id`,`approved_at`,`operational_status`,`created_at`,`updated_at`) VALUES (?, 'Sekolah Uji', ?, ?, ?, NOW(3), 'active', NOW(3), NOW(3))", [ids.tenant, `academic-${randomUUID()}`, npsn, ids.application]);
    await connection.execute("UPDATE `simas_application` SET `status`='approved',`decided_at`=NOW(3),`decided_by_provider_admin_id`=?,`approved_tenant_id`=? WHERE `id`=?", [ids.provider, ids.tenant, ids.application]);
    await connection.execute("UPDATE `user` SET `tenant_id`=?,`tenant_role`='school-admin' WHERE `id`=?", [ids.tenant, ids.owner]);
    const principal: MasterDataPrincipal = { userId: ids.owner, tenantId: ids.tenant, role: "school-admin", capabilities: { read: true, write: true, downloadTemplate: true } };
    const service = createAcademicYearService({ store: academicYearStore });
    const first = await service.create(principal, input("2026/2027", 2026));
    const second = await service.create(principal, input("2027/2028", 2027));
    assert.equal(first.ok && second.ok, true); if (!first.ok || !second.ok) return;
    const results = await Promise.all([service.transition(principal, first.year.id, "activate", "2026-07-01"), service.transition(principal, second.year.id, "activate", "2027-07-01")]);
    assert.equal(results.filter((result) => result.ok).length, 1);
    assert.equal(results.filter((result) => !result.ok && result.code === "active-conflict").length, 1);
    const [years] = await connection.execute<mysql.RowDataPacket[]>("SELECT id FROM academic_year WHERE tenant_id=? AND lifecycle='active'", [ids.tenant]);
    const [semesters] = await connection.execute<mysql.RowDataPacket[]>("SELECT id FROM academic_semester WHERE tenant_id=? AND status='active'", [ids.tenant]);
    assert.equal(years.length, 1); assert.equal(semesters.length, 1);
  } finally {
    await connection.execute("SET FOREIGN_KEY_CHECKS=0");
    for (const table of ["academic_year_history", "academic_semester", "academic_year"]) await connection.execute(`DELETE FROM \`${table}\` WHERE tenant_id=?`, [ids.tenant]);
    await connection.execute("UPDATE `user` SET tenant_id=NULL,tenant_role=NULL WHERE id=?", [ids.owner]);
    await connection.execute("DELETE FROM `tenant` WHERE id=?", [ids.tenant]);
    await connection.execute("DELETE FROM `simas_application` WHERE id=?", [ids.application]);
    await connection.execute("DELETE FROM `applicant_school_binding` WHERE id=?", [ids.binding]);
    await connection.execute("DELETE FROM `provider_admin` WHERE user_id=?", [ids.provider]);
    await connection.execute("DELETE FROM `user` WHERE id IN (?,?)", [ids.owner, ids.provider]);
    await connection.execute("SET FOREIGN_KEY_CHECKS=1"); await connection.end();
  }
});
