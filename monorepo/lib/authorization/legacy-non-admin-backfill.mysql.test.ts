import "dotenv/config";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after } from "node:test";

import mysql from "mysql2/promise";

import { closeDatabasePool } from "@/db";
import {
  backfillLegacyNonAdminUser,
  getLegacyBackfillCheckpoint,
  resetLegacyBackfillCheckpoint,
  runLegacyNonAdminBackfillPass,
  verifyLegacyNonAdminBackfill,
} from "@/lib/authorization/legacy-non-admin-backfill-data";

const FROZEN = ["tenant.dashboard.view", "tenant.users.view", "tenant.users.view-contact", "tenant.users.view-sensitive"];

const databaseUrl = process.env.DATABASE_URL;
const mysqlTest = databaseUrl ? test : test.skip;
after(() => closeDatabasePool());

type SetupIds = Readonly<{
  tenant: string;
  application: string;
  binding: string;
  owner: string;
  users: readonly { userId: string; role: string | null }[];
  sessions: readonly { userId: string; sessionId: string }[];
}>;

async function setup(connection: mysql.Connection): Promise<SetupIds> {
  const tenant = randomUUID();
  const application = randomUUID();
  const binding = randomUUID();
  const owner = randomUUID();
  const npsn = String(Math.floor(10_000_000 + Math.random() * 90_000_000));
  const users = Array.from({ length: 5 }, (_, index) => ({
    userId: randomUUID(),
    role: ["guru", "staff", "pimpinan", "siswa", "guest"][index] as string | null,
  }));
  const sessions = users.slice(0, 2).map((entry) => ({ userId: entry.userId, sessionId: randomUUID() }));

  const allUserIds = [owner, ...users.map((entry) => entry.userId)];
  const userPlaceholders = allUserIds.map(() => "(?,?,?,false,NOW(3),NOW(3))").join(",");
  const userValues = allUserIds.flatMap((userId) => [userId, `user-${userId}`, `u-${userId}@test.invalid`]);
  await connection.execute(
    `INSERT INTO \`user\` (\`id\`,\`name\`,\`email\`,\`email_verified\`,\`created_at\`,\`updated_at\`) VALUES ${userPlaceholders}`,
    userValues,
  );
  await connection.execute(
    "INSERT INTO `applicant_school_binding` (`id`,`user_id`,`canonical_npsn`,`created_at`) VALUES (?,?,?,NOW(3))",
    [binding, owner, npsn],
  );
  await connection.execute(
    "INSERT INTO `simas_application` (`id`,`school_name`,`npsn`,`education_level`,`address`,`contact_name`,`contact_position`,`contact_email`,`contact_whatsapp`,`status`,`submitted_at`,`owner_user_id`,`binding_id`,`attempt_number`,`idempotency_key`,`payload_hash`) VALUES (?,'Sekolah Backfill',?,'SMA','Alamat','Kontak','Operator',?,'0812','pending',NOW(3),?,?,1,?,REPEAT('a',64))",
    [application, npsn, `${application}@test.invalid`, owner, binding, randomUUID()],
  );
  await connection.execute(
    "INSERT INTO `tenant` (`id`,`name`,`domain`,`npsn`,`source_application_id`,`approved_at`,`operational_status`,`created_at`,`updated_at`) VALUES (?,'Sekolah Backfill',?,?,?,NOW(3),'active',NOW(3),NOW(3))",
    [tenant, `backfill-${tenant}`, npsn, application],
  );
  for (const entry of users) {
    await connection.execute(
      "UPDATE `user` SET `tenant_id`=?,`tenant_role`=? WHERE `id`=?",
      [tenant, entry.role, entry.userId],
    );
  }
  for (const session of sessions) {
    await connection.execute(
      "INSERT INTO `session` (`id`,`expires_at`,`token`,`created_at`,`updated_at`,`user_id`) VALUES (?,DATE_ADD(NOW(3),INTERVAL 1 DAY),?,NOW(3),NOW(3),?)",
      [session.sessionId, randomUUID(), session.userId],
    );
  }
  return { tenant, application, binding, owner, users, sessions };
}

async function cleanup(connection: mysql.Connection, ids: SetupIds) {
  await connection.execute("SET FOREIGN_KEY_CHECKS=0");
  await connection.execute("DELETE FROM `security_audit_event` WHERE `tenant_id`=?", [ids.tenant]);
  await connection.execute("DELETE FROM `security_outbox` WHERE `tenant_id`=?", [ids.tenant]);
  await connection.execute("DELETE FROM `security_command` WHERE `tenant_id`=?", [ids.tenant]);
  await connection.execute("DELETE FROM `security_audit_head` WHERE `tenant_id`=?", [ids.tenant]);
  await connection.execute("DELETE FROM `security_reconciliation_finding` WHERE `tenant_id`=?", [ids.tenant]);
  await connection.execute("DELETE FROM `tenant_role_assignment` WHERE `tenant_id`=?", [ids.tenant]);
  await connection.execute("DELETE FROM `tenant_role_permission` WHERE `tenant_id`=?", [ids.tenant]);
  await connection.execute("DELETE FROM `tenant_role` WHERE `tenant_id`=?", [ids.tenant]);
  await connection.execute(
    "DELETE FROM `security_reconciliation_finding` WHERE `migration_key`='legacy-non-admin-backfill-v1' AND `scope_key`='verifier'",
  );
  await connection.execute(
    "DELETE FROM `security_reconciliation_finding` WHERE `migration_key`='legacy-non-admin-backfill-v1' AND `tenant_id` IS NULL",
  );
  await connection.execute(
    "DELETE FROM `security_migration_checkpoint` WHERE `migration_key`='legacy-non-admin-backfill-v1'",
  );
  await connection.execute(
    "DELETE FROM `security_command` WHERE `security_context_kind`='provider' AND `context_id`='simas-provider'",
  );
  await connection.execute(
    "DELETE FROM `security_audit_event` WHERE `security_context_kind`='provider' AND `context_id`='simas-provider'",
  );
  await connection.execute(
    "DELETE FROM `security_outbox` WHERE `security_context_kind`='provider' AND `context_id`='simas-provider'",
  );
  await connection.execute("DELETE FROM `security_audit_head` WHERE `security_context_kind`='provider' AND `context_id`='simas-provider'");
  for (const session of ids.sessions) {
    await connection.execute("DELETE FROM `session` WHERE `id`=?", [session.sessionId]);
  }
  const userIds = [...ids.users.map((entry) => entry.userId), ids.owner];
  const placeholders = userIds.map(() => "?").join(",");
  await connection.execute(
    "DELETE FROM `provider_admin` WHERE `user_id` IN (" + placeholders + ")",
    userIds,
  );
  await connection.execute(
    "UPDATE `user` SET `tenant_id`=NULL,`tenant_role`=NULL WHERE `id` IN (" + placeholders + ")",
    userIds,
  );
  await connection.execute("DELETE FROM `user` WHERE `id` IN (" + placeholders + ")", userIds);
  await connection.execute("DELETE FROM `tenant` WHERE `id`=?", [ids.tenant]);
  await connection.execute("DELETE FROM `simas_application` WHERE `id`=?", [ids.application]);
  await connection.execute("DELETE FROM `applicant_school_binding` WHERE `id`=?", [ids.binding]);
  await connection.execute("SET FOREIGN_KEY_CHECKS=1");
}

async function count(connection: mysql.Connection, table: string, tenantId: string): Promise<number> {
  const [rows] = await connection.execute<mysql.RowDataPacket[]>(
    `SELECT COUNT(*) AS count FROM \`${table}\` WHERE \`tenant_id\`=?`,
    [tenantId],
  );
  return Number(rows[0].count);
}

mysqlTest("MySQL backfills recognized legacy non-admin roles into frozen assignments and keeps sessions", async () => {
  const connection = await mysql.createConnection(databaseUrl!);
  const ids = await setup(connection);
  try {
    const runId = randomUUID();
    for (const entry of ids.users) {
      const result = await backfillLegacyNonAdminUser({
        userId: entry.userId,
        tenantId: ids.tenant,
        runId,
        correlationId: randomUUID(),
      });
      assert.equal(result.status, "backfilled", entry.role ?? "role");
      assert.ok(result.roleId);
      assert.ok(result.assignmentId);
    }

    const [roles] = await connection.execute<mysql.RowDataPacket[]>(
      "SELECT `id`,`name`,`normalized_name`,`lifecycle`,`origin`,`legacy_role`,`migration_run_id`,`migration_version`,`migration_verification` FROM `tenant_role` WHERE `tenant_id`=? ORDER BY `legacy_role`",
      [ids.tenant],
    );
    assert.equal(roles.length, 5);
    for (const role of roles) {
      assert.equal(role.lifecycle, "active");
      assert.equal(role.origin, "legacy-migration");
      assert.ok(role.legacy_role);
      assert.ok(role.migration_run_id);
      assert.equal(role.migration_version, "tenant-permissions@1");
      assert.equal(role.migration_verification, "pending");
    }

    const [permissions] = await connection.execute<mysql.RowDataPacket[]>(
      "SELECT DISTINCT `permission_key` FROM `tenant_role_permission` WHERE `tenant_id`=? ORDER BY `permission_key`",
      [ids.tenant],
    );
    assert.deepEqual(
      permissions.map((row) => row.permission_key),
      [...FROZEN].sort(),
    );
    const [guruRole] = await connection.execute<mysql.RowDataPacket[]>(
      "SELECT `id` FROM `tenant_role` WHERE `tenant_id`=? AND `legacy_role`='guru' LIMIT 1",
      [ids.tenant],
    );
    const [guruPermissions] = await connection.execute<mysql.RowDataPacket[]>(
      "SELECT `permission_key` FROM `tenant_role_permission` WHERE `role_id`=? ORDER BY `permission_key`",
      [guruRole[0].id],
    );
    assert.deepEqual(
      guruPermissions.map((row) => row.permission_key),
      [...FROZEN].sort(),
      "each frozen role holds exactly the approved permission set",
    );

    const assignmentCount = await count(connection, "tenant_role_assignment", ids.tenant);
    assert.equal(assignmentCount, 5);
    const [assignmentRows] = await connection.execute<mysql.RowDataPacket[]>(
      "SELECT `state` FROM `tenant_role_assignment` WHERE `tenant_id`=?",
      [ids.tenant],
    );
    assert.ok(assignmentRows.every((row) => row.state === "active"));

    for (const session of ids.sessions) {
      const [sessions] = await connection.execute<mysql.RowDataPacket[]>(
        "SELECT `id` FROM `session` WHERE `id`=?",
        [session.sessionId],
      );
      assert.equal(sessions.length, 1, "existing session must survive backfill");
    }

    const [auditEvents] = await connection.execute<mysql.RowDataPacket[]>(
      "SELECT COUNT(*) AS count FROM `security_audit_event` WHERE `tenant_id`=? AND `event_type`='tenant_role.legacy_migration_backfilled'",
      [ids.tenant],
    );
    assert.equal(Number(auditEvents[0].count), 5);
  } finally {
    await cleanup(connection, ids);
    await connection.end();
  }
});

mysqlTest("MySQL backfill is idempotent within a run and deterministic across reruns", async () => {
  const connection = await mysql.createConnection(databaseUrl!);
  const ids = await setup(connection);
  try {
    const entry = ids.users[0]!;
    const runId = randomUUID();
    const first = await backfillLegacyNonAdminUser({
      userId: entry.userId,
      tenantId: ids.tenant,
      runId,
      correlationId: randomUUID(),
    });
    const replay = await backfillLegacyNonAdminUser({
      userId: entry.userId,
      tenantId: ids.tenant,
      runId,
      correlationId: randomUUID(),
    });
    assert.equal(first.status, "backfilled");
    assert.deepEqual(replay, first, "same run replays the stored result");

    const secondRun = await backfillLegacyNonAdminUser({
      userId: entry.userId,
      tenantId: ids.tenant,
      runId: randomUUID(),
      correlationId: randomUUID(),
    });
    assert.equal(secondRun.status, "unchanged", "a fresh run converges without duplicates");

    assert.equal(await count(connection, "tenant_role", ids.tenant), 1);
    assert.equal(await count(connection, "tenant_role_assignment", ids.tenant), 1);
    const [auditEvents] = await connection.execute<mysql.RowDataPacket[]>(
      "SELECT COUNT(*) AS count FROM `security_audit_event` WHERE `tenant_id`=? AND `event_type`='tenant_role.legacy_migration_backfilled'",
      [ids.tenant],
    );
    assert.equal(Number(auditEvents[0].count), 1);
  } finally {
    await cleanup(connection, ids);
    await connection.end();
  }
});

mysqlTest("MySQL backfill is resumable across interrupted runs through the checkpoint", async () => {
  const connection = await mysql.createConnection(databaseUrl!);
  const ids = await setup(connection);
  try {
    const firstPass = await runLegacyNonAdminBackfillPass({ batchSize: 1, runId: "run-1" });
    assert.equal(firstPass.done, false);
    assert.equal(firstPass.migrated, 1);

    const secondPass = await runLegacyNonAdminBackfillPass({ batchSize: 20, runId: "run-2" });
    assert.equal(secondPass.done, true);
    assert.equal(secondPass.migrated, 5);

    const checkpoint = await getLegacyBackfillCheckpoint();
    assert.equal(checkpoint?.state, "completed");
    assert.equal(checkpoint?.sourceWatermark, checkpoint?.cursor);
    assert.equal(await count(connection, "tenant_role_assignment", ids.tenant), 5);

    const rerun = await runLegacyNonAdminBackfillPass({ batchSize: 20, runId: "run-3" });
    assert.equal(rerun.done, true, "completed checkpoint short-circuits deterministically");
    assert.equal(await count(connection, "tenant_role_assignment", ids.tenant), 5);

    await resetLegacyBackfillCheckpoint();
    const forced = await runLegacyNonAdminBackfillPass({ batchSize: 20, runId: "run-4" });
    assert.equal(forced.done, true);
    assert.equal(await count(connection, "tenant_role_assignment", ids.tenant), 5, "force rerun still converges to one assignment per user");
  } finally {
    await cleanup(connection, ids);
    await connection.end();
  }
});

mysqlTest("MySQL backfill converges safely under concurrent writes", async () => {
  const connection = await mysql.createConnection(databaseUrl!);
  const ids = await setup(connection);
  try {
    const [guru, staff] = ids.users;
    assert.ok(guru && staff);
    const results = await Promise.all([
      backfillLegacyNonAdminUser({ userId: guru.userId, tenantId: ids.tenant, runId: "concurrent-a", correlationId: randomUUID() }),
      backfillLegacyNonAdminUser({ userId: guru.userId, tenantId: ids.tenant, runId: "concurrent-b", correlationId: randomUUID() }),
      backfillLegacyNonAdminUser({ userId: staff.userId, tenantId: ids.tenant, runId: "concurrent-a", correlationId: randomUUID() }),
    ]);
    const statuses = results.map((result) => result.status);
    assert.ok(statuses.includes("backfilled"), statuses.join(","));
    assert.ok(statuses.filter((status) => status === "backfilled").length >= 1);
    assert.equal(await count(connection, "tenant_role", ids.tenant), 2, "one frozen role per legacy kind under concurrency");
    assert.equal(await count(connection, "tenant_role_assignment", ids.tenant), 2);
    const [rows] = await connection.execute<mysql.RowDataPacket[]>(
      "SELECT `tenant_id`,`user_id`,`role_id` FROM `tenant_role_assignment` WHERE `tenant_id`=? ORDER BY `user_id`",
      [ids.tenant],
    );
    const seen = new Set(rows.map((row) => `${row.user_id}:${row.role_id}`));
    assert.equal(seen.size, 2, "no duplicate (user, role) assignments");
  } finally {
    await cleanup(connection, ids);
    await connection.end();
  }
});

mysqlTest("MySQL records findings with no grant for null, identity-conflicting, and conflicting-role states", async () => {
  const connection = await mysql.createConnection(databaseUrl!);
  const ids = await setup(connection);
  const nullRoleUser = randomUUID();
  const providerAdmin = randomUUID();
  try {
    await connection.execute(
      "INSERT INTO `user` (`id`,`name`,`email`,`email_verified`,`tenant_id`,`tenant_role`,`created_at`,`updated_at`) VALUES (?,?,?,false,?,NULL,NOW(3),NOW(3))",
      [nullRoleUser, "Null Role", `null-${nullRoleUser}@test.invalid`, ids.tenant],
    );
    await connection.execute(
      "INSERT INTO `user` (`id`,`name`,`email`,`email_verified`,`tenant_id`,`tenant_role`,`created_at`,`updated_at`) VALUES (?,?,?,false,?,?,NOW(3),NOW(3))",
      [providerAdmin, "Provider With Role", `provider-${providerAdmin}@test.invalid`, ids.tenant, "guru"],
    );
    await connection.execute("INSERT INTO `provider_admin` (`user_id`,`created_at`) VALUES (?,NOW(3))", [providerAdmin]);

    const runId = randomUUID();
    const nullResult = await backfillLegacyNonAdminUser({
      userId: nullRoleUser,
      tenantId: ids.tenant,
      runId,
      correlationId: randomUUID(),
    });
    assert.equal(nullResult.status, "finding");
    assert.equal(nullResult.findingCode, "legacy-backfill-role-null");

    const identityResult = await backfillLegacyNonAdminUser({
      userId: providerAdmin,
      tenantId: ids.tenant,
      runId,
      correlationId: randomUUID(),
    });
    assert.equal(identityResult.status, "finding");
    assert.equal(identityResult.findingCode, "legacy-backfill-identity-conflict");

    const [findings] = await connection.execute<mysql.RowDataPacket[]>(
      "SELECT `reason_code`,`severity`,`state`,`tenant_id` FROM `security_reconciliation_finding` WHERE `migration_key`='legacy-non-admin-backfill-v1' AND `tenant_id`=? ORDER BY `reason_code`",
      [ids.tenant],
    );
    const byCode = new Map(findings.map((row) => [row.reason_code, row]));
    assert.deepEqual(byCode.get("legacy-backfill-role-null")?.severity, "warning");
    assert.deepEqual(byCode.get("legacy-backfill-identity-conflict")?.severity, "blocking");
    assert.ok(findings.every((row) => row.state === "open"));

    const noAssignmentForNull = await count(connection, "tenant_role_assignment", ids.tenant);
    assert.equal(noAssignmentForNull, 0, "findings grant nothing");

    const [globalFindings] = await connection.execute<mysql.RowDataPacket[]>(
      "SELECT `finding_key` FROM `security_reconciliation_finding` WHERE `migration_key`='legacy-non-admin-backfill-v1' AND `tenant_id` IS NULL AND `scope_key`='global'",
    );
    assert.equal(globalFindings.length, 0, "same-Tenant findings reference the Tenant");

    const [guruRoles] = await connection.execute<mysql.RowDataPacket[]>(
      "SELECT COUNT(*) AS count FROM `tenant_role` WHERE `tenant_id`=? AND `legacy_role`='guru'",
      [ids.tenant],
    );
    assert.equal(Number(guruRoles[0].count), 0, "no frozen role is created for a conflicting user");
  } finally {
    await connection.execute(
      "DELETE FROM `security_audit_event` WHERE `tenant_id`=? AND `target_user_id` IN (?,?)",
      [ids.tenant, nullRoleUser, providerAdmin],
    );
    await connection.execute(
      "DELETE FROM `security_reconciliation_finding` WHERE `tenant_id`=? AND `user_id` IN (?,?)",
      [ids.tenant, nullRoleUser, providerAdmin],
    );
    await connection.execute(
      "UPDATE `user` SET `tenant_id`=NULL,`tenant_role`=NULL WHERE `id` IN (?,?)",
      [nullRoleUser, providerAdmin],
    );
    await connection.execute("DELETE FROM `provider_admin` WHERE `user_id`=?", [providerAdmin]);
    await connection.execute("DELETE FROM `user` WHERE `id` IN (?,?)", [nullRoleUser, providerAdmin]);
    await cleanup(connection, ids);
    await connection.end();
  }
});

mysqlTest("MySQL records a role-conflict finding when a Tenant-created role claims the frozen name", async () => {
  const connection = await mysql.createConnection(databaseUrl!);
  const ids = await setup(connection);
  try {
    const entry = ids.users[0]!;
    const now = new Date();
    await connection.execute(
      "INSERT INTO `tenant_role` (`id`,`tenant_id`,`name`,`normalized_name`,`lifecycle`,`origin`,`template_key`,`template_version`,`copied_from_role_id`,`legacy_role`,`migration_run_id`,`migration_version`,`migration_verification`,`version`,`created_at`,`updated_at`) VALUES (?,?,'Guru (Migrasi)','guru (migrasi)','draft','scratch',NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,?,?)",
      [randomUUID(), ids.tenant, now, now],
    );
    const result = await backfillLegacyNonAdminUser({
      userId: entry.userId,
      tenantId: ids.tenant,
      runId: randomUUID(),
      correlationId: randomUUID(),
    });
    assert.equal(result.status, "finding");
    assert.equal(result.findingCode, "legacy-backfill-role-conflict");
    assert.equal(await count(connection, "tenant_role_assignment", ids.tenant), 0);
  } finally {
    await cleanup(connection, ids);
    await connection.end();
  }
});

mysqlTest("MySQL never re-activates a suspended frozen assignment", async () => {
  const connection = await mysql.createConnection(databaseUrl!);
  const ids = await setup(connection);
  try {
    const entry = ids.users[0]!;
    const now = new Date();
    const roleId = randomUUID();
    await connection.execute(
      "INSERT INTO `tenant_role` (`id`,`tenant_id`,`name`,`normalized_name`,`lifecycle`,`origin`,`legacy_role`,`migration_run_id`,`migration_version`,`migration_verification`,`version`,`created_at`,`updated_at`) VALUES (?,?,'Guru (Migrasi)','guru (migrasi)','active','legacy-migration','guru',?,?,?,1,?,?)",
      [roleId, ids.tenant, randomUUID(), "tenant-permissions@1", "pending", now, now],
    );
    for (const permissionKey of FROZEN) {
      await connection.execute(
        "INSERT INTO `tenant_role_permission` (`tenant_id`,`role_id`,`permission_key`,`created_at`) VALUES (?,?,?,?)",
        [ids.tenant, roleId, permissionKey, now],
      );
    }
    await connection.execute(
      "INSERT INTO `tenant_role_assignment` (`id`,`tenant_id`,`user_id`,`role_id`,`state`,`version`,`assigned_at`,`suspended_at`,`updated_at`) VALUES (?,?,?,?,'suspended',1,?,?,?)",
      [randomUUID(), ids.tenant, entry.userId, roleId, now, now, now],
    );
    const result = await backfillLegacyNonAdminUser({
      userId: entry.userId,
      tenantId: ids.tenant,
      runId: randomUUID(),
      correlationId: randomUUID(),
    });
    assert.equal(result.status, "finding");
    assert.equal(result.findingCode, "legacy-backfill-assignment-conflict");
    const [assignments] = await connection.execute<mysql.RowDataPacket[]>(
      "SELECT `state` FROM `tenant_role_assignment` WHERE `tenant_id`=? AND `user_id`=?",
      [ids.tenant, entry.userId],
    );
    assert.deepEqual(assignments.map((row) => row.state), ["suspended"]);
  } finally {
    await cleanup(connection, ids);
    await connection.end();
  }
});

mysqlTest("MySQL verifier proves equivalence at a watermark and flags tampered roles", async () => {
  const connection = await mysql.createConnection(databaseUrl!);
  const ids = await setup(connection);
  try {
    const runId = randomUUID();
    for (const entry of ids.users) {
      await backfillLegacyNonAdminUser({
        userId: entry.userId,
        tenantId: ids.tenant,
        runId,
        correlationId: randomUUID(),
      });
    }
    await runLegacyNonAdminBackfillPass({ batchSize: 20, runId });
    const checkpoint = await getLegacyBackfillCheckpoint();
    assert.equal(checkpoint?.state, "completed");

    const clean = await verifyLegacyNonAdminBackfill();
    assert.equal(clean.equivalent, true);
    assert.deepEqual(clean.mismatchedRoleIds, []);
    assert.deepEqual(clean.widened, []);
    assert.deepEqual(clean.narrowed, []);
    assert.equal(clean.watermark, checkpoint?.sourceWatermark);
    assert.ok(clean.contractDigest.length === 64);
    assert.ok(clean.evaluatedUserCount >= 5);
    assert.ok(clean.roleCount >= 5, `roleCount=${clean.roleCount}`);
    assert.ok(clean.assignmentCount >= 5, `assignmentCount=${clean.assignmentCount}`);

    const [roleRow] = await connection.execute<mysql.RowDataPacket[]>(
      "SELECT `id` FROM `tenant_role` WHERE `tenant_id`=? AND `legacy_role`='guru' LIMIT 1",
      [ids.tenant],
    );
    assert.ok(roleRow[0]);
    const tamperedRoleId = roleRow[0].id;
    await connection.execute(
      "DELETE FROM `tenant_role_permission` WHERE `tenant_id`=? AND `role_id`=? AND `permission_key`='tenant.users.view-sensitive'",
      [ids.tenant, tamperedRoleId],
    );

    const tampered = await verifyLegacyNonAdminBackfill();
    assert.equal(tampered.equivalent, false);
    assert.deepEqual(tampered.mismatchedRoleIds, [tamperedRoleId]);

    const [verification] = await connection.execute<mysql.RowDataPacket[]>(
      "SELECT `migration_verification` FROM `tenant_role` WHERE `id`=?",
      [tamperedRoleId],
    );
    assert.equal(verification[0].migration_verification, "mismatch");

    const [attestation] = await connection.execute<mysql.RowDataPacket[]>(
      "SELECT `state`,`reason_code` FROM `security_reconciliation_finding` WHERE `migration_key`='legacy-non-admin-backfill-v1' AND `scope_key`='verifier'",
    );
    assert.equal(attestation[0].reason_code, "legacy-rbac-equivalence");
    assert.equal(attestation[0].state, "open");
  } finally {
    await cleanup(connection, ids);
    await connection.end();
  }
});
