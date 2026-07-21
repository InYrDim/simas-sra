import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after } from "node:test";
import mysql from "mysql2/promise";

import { closeDatabasePool } from "@/db";
import { createHeadmasterAssignmentService } from "@/lib/headmaster-assignment";
import { headmasterAssignmentStore } from "@/lib/headmaster-assignment-data";
import { createTeacherMasterDataService } from "@/lib/teacher-master-data";
import { teacherMasterDataStore } from "@/lib/teacher-master-data-data";
import type { MasterDataPrincipal } from "@/lib/tenant-master-data-access";

const url = process.env.DATABASE_URL, mysqlTest = url ? test : test.skip;
after(() => closeDatabasePool());

async function tenantFixture(label: string) {
  const connection = await mysql.createConnection(url!);
  const ids = { provider: randomUUID(), tenant: randomUUID(), admin: randomUUID(), binding: randomUUID(), application: randomUUID() };
  const npsn = String(Math.floor(10_000_000 + Math.random() * 80_000_000));
  await connection.execute("INSERT INTO `user` (`id`,`name`,`email`,`email_verified`,`created_at`,`updated_at`) VALUES (?, 'Provider', ?, false, NOW(3), NOW(3)), (?, 'Admin', ?, false, NOW(3), NOW(3))", [ids.provider, `${ids.provider}@test.invalid`, ids.admin, `${ids.admin}@test.invalid`]);
  await connection.execute("INSERT INTO `provider_admin` (`user_id`,`created_at`) VALUES (?, NOW(3))", [ids.provider]);
  await connection.execute("INSERT INTO `applicant_school_binding` (`id`,`user_id`,`canonical_npsn`,`created_at`) VALUES (?, ?, ?, NOW(3))", [ids.binding, ids.admin, npsn]);
  await connection.execute("INSERT INTO `simas_application` (`id`,`school_name`,`npsn`,`education_level`,`address`,`contact_name`,`contact_position`,`contact_email`,`contact_whatsapp`,`status`,`submitted_at`,`owner_user_id`,`binding_id`,`attempt_number`,`idempotency_key`,`payload_hash`) VALUES (?, ?, ?, 'SMA', 'Alamat', 'Kontak', 'Operator', ?, '0812', 'pending', NOW(3), ?, ?, 1, ?, REPEAT('a',64))", [ids.application, label, npsn, `${ids.application}@test.invalid`, ids.admin, ids.binding, randomUUID()]);
  await connection.execute("INSERT INTO `tenant` (`id`,`name`,`domain`,`npsn`,`source_application_id`,`approved_at`,`operational_status`,`created_at`,`updated_at`) VALUES (?, ?, ?, ?, ?, NOW(3), 'active', NOW(3), NOW(3))", [ids.tenant, label, `headmaster-${randomUUID()}`, npsn, ids.application]);
  await connection.execute("UPDATE `simas_application` SET `status`='approved',`decided_at`=NOW(3),`decided_by_provider_admin_id`=?,`approved_tenant_id`=? WHERE `id`=?", [ids.provider, ids.tenant, ids.application]);
  await connection.execute("UPDATE `user` SET `tenant_id`=?,`tenant_role`='school-admin' WHERE `id`=?", [ids.tenant, ids.admin]);
  const principal: MasterDataPrincipal = { userId: ids.admin, tenantId: ids.tenant, role: "school-admin", capabilities: { read: true, write: true, downloadTemplate: true } };
  return { connection, ids, principal };
}

async function cleanup(data: Awaited<ReturnType<typeof tenantFixture>>) {
  const { connection, ids } = data;
  await connection.execute("DELETE FROM `headmaster_assignment_audit` WHERE `tenant_id`=?", [ids.tenant]).catch(() => undefined);
  await connection.execute("DELETE FROM `headmaster_assignment` WHERE `tenant_id`=?", [ids.tenant]).catch(() => undefined);
  await connection.execute("DELETE FROM `teacher_audit` WHERE `tenant_id`=?", [ids.tenant]).catch(() => undefined);
  await connection.execute("DELETE FROM `teacher_service_period` WHERE `tenant_id`=?", [ids.tenant]).catch(() => undefined);
  await connection.execute("DELETE FROM `teacher_profile` WHERE `tenant_id`=?", [ids.tenant]).catch(() => undefined);
  await connection.execute("DELETE FROM `school_person` WHERE `tenant_id`=?", [ids.tenant]).catch(() => undefined);
  await connection.execute("UPDATE `user` SET `tenant_id`=NULL,`tenant_role`=NULL WHERE `id`=?", [ids.admin]).catch(() => undefined);
  await connection.execute("DELETE FROM `tenant` WHERE `id`=?", [ids.tenant]).catch(() => undefined);
  await connection.execute("DELETE FROM `simas_application` WHERE `id`=?", [ids.application]).catch(() => undefined);
  await connection.execute("DELETE FROM `applicant_school_binding` WHERE `id`=?", [ids.binding]).catch(() => undefined);
  await connection.execute("DELETE FROM `provider_admin` WHERE `user_id`=?", [ids.provider]).catch(() => undefined);
  await connection.execute("DELETE FROM `user` WHERE `id` IN (?,?)", [ids.provider, ids.admin]).catch(() => undefined);
  await connection.end();
}

const teacherInput = (number: string, name: string) => ({ fullName: name, birthPlace: "Palu", birthDate: "1980-01-01", gender: "female", street: "Jalan Sekolah", teacherNumber: number, employmentType: "civil-servant", assignmentStatus: "active", serviceStartDate: "2020-01-01" });

mysqlTest("MySQL serializes concurrent headmaster replacement, isolates Tenants, audits, and blocks archive", async () => {
  const a = await tenantFixture("Sekolah A"), b = await tenantFixture("Sekolah B");
  try {
    const teachers = createTeacherMasterDataService({ store: teacherMasterDataStore });
    const first = await teachers.create(a.principal, teacherInput(`A-${randomUUID()}`, "Ibu Aminah"));
    const second = await teachers.create(a.principal, teacherInput(`B-${randomUUID()}`, "Ibu Budi"));
    const other = await teachers.create(b.principal, teacherInput(`C-${randomUUID()}`, "Ibu Citra"));
    assert.equal(first.ok, true); assert.equal(second.ok, true); assert.equal(other.ok, true); if (!first.ok || !second.ok || !other.ok) return;
    const service = createHeadmasterAssignmentService({ store: headmasterAssignmentStore });
    assert.equal((await service.assign(a.principal, { teacherId: first.record.teacher.id, effectiveDate: "2025-01-01", reason: "Penetapan" })).ok, true);
    assert.deepEqual(await service.assign(a.principal, { teacherId: other.record.teacher.id, effectiveDate: "2025-02-01", reason: "Lintas Tenant" }), { ok: false, code: "invalid-teacher" });
    const raced = await Promise.all([
      service.assign(a.principal, { teacherId: second.record.teacher.id, effectiveDate: "2025-02-01", reason: "Pergantian pertama" }),
      service.assign(a.principal, { teacherId: first.record.teacher.id, effectiveDate: "2025-02-01", reason: "Pergantian kedua" }),
    ]);
    assert.equal(raced.every((result) => result.ok), true);
    const [rows] = await a.connection.query<mysql.RowDataPacket[]>("SELECT `teacher_id`,`started_at`,`ended_at` FROM `headmaster_assignment` WHERE `tenant_id`=? ORDER BY `started_at`", [a.ids.tenant]);
    assert.equal(rows.length, 3); assert.equal(rows.filter((row) => row.ended_at === null).length, 1);
    const [audits] = await a.connection.query<mysql.RowDataPacket[]>("SELECT `operation` FROM `headmaster_assignment_audit` WHERE `tenant_id`=? ORDER BY `effective_date`", [a.ids.tenant]);
    assert.deepEqual(audits.map((row) => row.operation), ["assigned", "replaced", "replaced"]);
    const currentTeacherId = rows.find((row) => row.ended_at === null)!.teacher_id as string;
    const currentRecord = (await teachers.list(a.principal)).find((record) => record.teacher.id === currentTeacherId)!;
    assert.equal((await teachers.transition(a.principal, currentTeacherId, { toStatus: "ended", effectiveDate: "2025-04-01", reason: "Berakhir", expectedVersion: currentRecord.teacher.version })).ok, true);
    const denied = await teachers.archive(a.principal, currentTeacherId, { reason: "Arsip", expectedVersion: currentRecord.teacher.version + 1 });
    assert.equal(denied.ok, false); if (!denied.ok) assert.equal(denied.code, "relationship-blocked");
    await assert.rejects(a.connection.execute("INSERT INTO `headmaster_assignment` (`id`,`tenant_id`,`teacher_id`,`started_at`,`reason`,`created_by_user_id`,`created_at`) VALUES (?, ?, ?, '2026-01-01', 'Cross', ?, NOW(3))", [randomUUID(), a.ids.tenant, other.record.teacher.id, a.ids.admin]));
  } finally { await cleanup(a); await cleanup(b); }
});
