import "dotenv/config";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after } from "node:test";

import mysql from "mysql2/promise";

import { closeDatabasePool } from "@/db";
import {
  disableSchoolAdminAuthority,
  projectSchoolAdminCompatibility,
} from "@/lib/authorization/school-admin-authority-data";
import { SecurityCommandError } from "@/lib/authorization/security-command";
import { getCentralIdentity } from "@/lib/platform/central-identity-data";


const databaseUrl = process.env.DATABASE_URL;
const mysqlTest = databaseUrl ? test : test.skip;
after(() => closeDatabasePool());

async function setup(connection: mysql.Connection) {
  const ids = {
    tenant: randomUUID(),
    application: randomUUID(),
    binding: randomUUID(),
    provider: randomUUID(),
    adminA: randomUUID(),
    adminB: randomUUID(),
    sessionA: randomUUID(),
  };
  const npsn = String(Math.floor(10_000_000 + Math.random() * 90_000_000));
  await connection.execute(
    "INSERT INTO `user` (`id`,`name`,`email`,`email_verified`,`created_at`,`updated_at`) VALUES (?,'Admin A',?,false,NOW(3),NOW(3)),(?,'Admin B',?,false,NOW(3),NOW(3)),(?,'Provider',?,false,NOW(3),NOW(3))",
    [ids.adminA, `${ids.adminA}@test.invalid`, ids.adminB, `${ids.adminB}@test.invalid`, ids.provider, `${ids.provider}@test.invalid`],
  );
  await connection.execute("INSERT INTO `provider_admin` (`user_id`,`created_at`) VALUES (?,NOW(3))", [ids.provider]);
  await connection.execute(
    "INSERT INTO `applicant_school_binding` (`id`,`user_id`,`canonical_npsn`,`created_at`) VALUES (?,?,?,NOW(3))",
    [ids.binding, ids.adminA, npsn],
  );
  await connection.execute(
    "INSERT INTO `simas_application` (`id`,`school_name`,`npsn`,`education_level`,`address`,`contact_name`,`contact_position`,`contact_email`,`contact_whatsapp`,`status`,`submitted_at`,`owner_user_id`,`binding_id`,`attempt_number`,`idempotency_key`,`payload_hash`) VALUES (?,'Sekolah Authority',?,'SMA','Alamat','Kontak','Operator',?,'0812','pending',NOW(3),?,?,1,?,REPEAT('a',64))",
    [ids.application, npsn, `${ids.application}@test.invalid`, ids.adminA, ids.binding, randomUUID()],
  );
  await connection.execute(
    "INSERT INTO `tenant` (`id`,`name`,`domain`,`npsn`,`source_application_id`,`approved_at`,`operational_status`,`created_at`,`updated_at`) VALUES (?,'Sekolah Authority',?,?,?,NOW(3),'active',NOW(3),NOW(3))",
    [ids.tenant, `authority-${ids.tenant}`, npsn, ids.application],
  );
  await connection.execute(
    "UPDATE `user` SET `tenant_id`=?,`tenant_role`='school-admin' WHERE `id` IN (?,?)",
    [ids.tenant, ids.adminA, ids.adminB],
  );
  await connection.execute(
    "INSERT INTO `session` (`id`,`expires_at`,`token`,`created_at`,`updated_at`,`user_id`) VALUES (?,DATE_ADD(NOW(3),INTERVAL 1 DAY),?,NOW(3),NOW(3),?)",
    [ids.sessionA, randomUUID(), ids.adminA],
  );
  return ids;
}

async function cleanup(connection: mysql.Connection, ids: Awaited<ReturnType<typeof setup>>) {
  await connection.execute("SET FOREIGN_KEY_CHECKS=0");
  for (const table of [
    "security_audit_event",
    "security_outbox",
    "security_command",
    "security_audit_head",
    "security_reconciliation_finding",
    "school_admin_authority",
  ]) {
    const column = table === "security_reconciliation_finding" || table === "school_admin_authority" ? "tenant_id" : "context_id";
    await connection.execute(`DELETE FROM \`${table}\` WHERE \`${column}\`=?`, [ids.tenant]);
  }
  await connection.execute("DELETE FROM `session` WHERE `user_id` IN (?,?)", [ids.adminA, ids.adminB]);
  await connection.execute("UPDATE `user` SET `tenant_id`=NULL,`tenant_role`=NULL WHERE `id` IN (?,?)", [ids.adminA, ids.adminB]);
  await connection.execute("DELETE FROM `tenant` WHERE `id`=?", [ids.tenant]);
  await connection.execute("DELETE FROM `simas_application` WHERE `id`=?", [ids.application]);
  await connection.execute("DELETE FROM `applicant_school_binding` WHERE `id`=?", [ids.binding]);
  await connection.execute("DELETE FROM `provider_admin` WHERE `user_id`=?", [ids.provider]);
  await connection.execute("DELETE FROM `user` WHERE `id` IN (?,?,?)", [ids.adminA, ids.adminB, ids.provider]);
  await connection.execute("SET FOREIGN_KEY_CHECKS=1");
}

mysqlTest("MySQL projects same-Tenant School Admin authority idempotently and existing sessions resolve it", async () => {
  const connection = await mysql.createConnection(databaseUrl!);
  const ids = await setup(connection);
  try {
    const input = {
      principal: { kind: "authenticated-user" as const, userId: ids.provider },
      tenantId: ids.tenant,
      userId: ids.adminA,
      idempotencyKey: `project_${ids.adminA.replaceAll("-", "_")}`,
      correlationId: randomUUID(),
    };
    const first = await projectSchoolAdminCompatibility(input);
    const second = await projectSchoolAdminCompatibility({ ...input, correlationId: randomUUID() });
    assert.equal(first.status, "projected");
    assert.deepEqual(second, first);

    const [rows] = await connection.execute<mysql.RowDataPacket[]>(
      "SELECT `id`,`tenant_id`,`user_id`,`authority_state` FROM `school_admin_authority` WHERE `user_id`=?",
      [ids.adminA],
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].tenant_id, ids.tenant);
    assert.equal(rows[0].authority_state, "active");

    const identity = await getCentralIdentity(ids.adminA);
    assert.equal(identity.kind, "tenant-member");
  } finally {
    await cleanup(connection, ids);
    await connection.end();
  }
});

mysqlTest("MySQL persists a blocking reconciliation finding for malformed projection", async () => {
  const connection = await mysql.createConnection(databaseUrl!);
  const ids = await setup(connection);
  try {
    await connection.execute(
      "INSERT INTO `school_admin_authority` (`id`,`tenant_id`,`user_id`,`authority_state`,`version`,`granted_at`,`disabled_at`,`created_at`,`updated_at`) VALUES (?,?,?,'disabled',1,NOW(3),NOW(3),NOW(3),NOW(3))",
      [randomUUID(), ids.tenant, ids.adminA],
    );
    const result = await projectSchoolAdminCompatibility({
      principal: { kind: "authenticated-user", userId: ids.provider },
      tenantId: ids.tenant,
      userId: ids.adminA,
      idempotencyKey: `finding_${ids.adminA.replaceAll("-", "_")}`,
      correlationId: randomUUID(),
    });
    assert.deepEqual(result, {
      status: "finding",
      authorityId: null,
      findingCode: "school-admin-authority-malformed",
    });
    const [findings] = await connection.execute<mysql.RowDataPacket[]>(
      "SELECT `reason_code`,`severity`,`state` FROM `security_reconciliation_finding` WHERE `tenant_id`=? AND `user_id`=?",
      [ids.tenant, ids.adminA],
    );
    assert.deepEqual(findings.map((row) => ({ reasonCode: row.reason_code, severity: row.severity, state: row.state })), [{
      reasonCode: "school-admin-authority-malformed",
      severity: "blocking",
      state: "open",
    }]);
    assert.equal((await getCentralIdentity(ids.adminA)).kind, "invalid");
  } finally {
    await cleanup(connection, ids);
    await connection.end();
  }
});

mysqlTest("MySQL supports multiple active authorities and prevents zero coverage", async () => {
  const connection = await mysql.createConnection(databaseUrl!);
  const ids = await setup(connection);
  try {
    await assert.rejects(
      projectSchoolAdminCompatibility({
        principal: { kind: "authenticated-user", userId: ids.adminA },
        tenantId: ids.tenant,
        userId: ids.adminB,
        idempotencyKey: `tenant_denied_${ids.adminB.replaceAll("-", "_")}`,
        correlationId: randomUUID(),
      }),
      (error: unknown) => error instanceof SecurityCommandError && error.code === "context-denied",
    );
    for (const userId of [ids.adminA, ids.adminB]) {
      const result = await projectSchoolAdminCompatibility({
        principal: { kind: "authenticated-user", userId: ids.provider },
        tenantId: ids.tenant,
        userId,
        idempotencyKey: `project_${userId.replaceAll("-", "_")}`,
        correlationId: randomUUID(),
      });
      assert.equal(result.status, "projected");
    }

    assert.deepEqual(await disableSchoolAdminAuthority({
      principal: { kind: "authenticated-user", userId: ids.provider },
      tenantId: ids.tenant,
      userId: ids.adminA,
      expectedVersion: 1,
      reason: "Pergantian penanggung jawab sekolah",
      idempotencyKey: `disable_${ids.adminA.replaceAll("-", "_")}`,
      correlationId: randomUUID(),
    }), { status: "disabled", remainingActive: 1 });

    const [sessions] = await connection.execute<mysql.RowDataPacket[]>("SELECT `id` FROM `session` WHERE `user_id`=?", [ids.adminA]);
    assert.equal(sessions.length, 0);
    await assert.rejects(
      disableSchoolAdminAuthority({
        principal: { kind: "authenticated-user", userId: ids.provider },
        tenantId: ids.tenant,
        userId: ids.adminB,
        expectedVersion: 1,
        reason: "Tidak boleh mengosongkan cakupan",
        idempotencyKey: `disable_${ids.adminB.replaceAll("-", "_")}`,
        correlationId: randomUUID(),
      }),
      (error: unknown) => error instanceof SecurityCommandError && error.code === "integrity-failure",
    );
    const [active] = await connection.execute<mysql.RowDataPacket[]>(
      "SELECT COUNT(*) `count` FROM `school_admin_authority` WHERE `tenant_id`=? AND `authority_state`='active'",
      [ids.tenant],
    );
    assert.equal(Number(active[0].count), 1);
  } finally {
    await cleanup(connection, ids);
    await connection.end();
  }
});
