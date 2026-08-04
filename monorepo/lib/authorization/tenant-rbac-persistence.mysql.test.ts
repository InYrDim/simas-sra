import "dotenv/config";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;
const mysqlTest = databaseUrl ? test : test.skip;
const migrationUrl = new URL(
  "../../drizzle/20260731083635_expand-tenant-rbac-security/migration.sql",
  import.meta.url,
);

type MigrationShape = Readonly<{
  tables: ReadonlySet<string>;
  constraints: ReadonlySet<string>;
  indexes: ReadonlySet<string>;
}>;

function expectedMigrationShape(migration: string): MigrationShape {
  return {
    tables: new Set([...migration.matchAll(/CREATE TABLE `([^`]+)`/g)].map((match) => match[1])),
    constraints: new Set([...migration.matchAll(/CONSTRAINT `([^`]+)`/g)].map((match) => match[1])),
    indexes: new Set([...migration.matchAll(/CREATE INDEX `([^`]+)`/g)].map((match) => match[1])),
  };
}

async function persistedMigrationShape(connection: mysql.Connection): Promise<MigrationShape> {
  const [[tables], [constraints], [indexes]] = await Promise.all([
    connection.execute<mysql.RowDataPacket[]>(
      "SELECT `table_name` AS `name` FROM `information_schema`.`tables` WHERE `table_schema`=DATABASE()",
    ),
    connection.execute<mysql.RowDataPacket[]>(
      "SELECT `constraint_name` AS `name` FROM `information_schema`.`table_constraints` WHERE `constraint_schema`=DATABASE()",
    ),
    connection.execute<mysql.RowDataPacket[]>(
      "SELECT DISTINCT `index_name` AS `name` FROM `information_schema`.`statistics` WHERE `table_schema`=DATABASE()",
    ),
  ]);

  return {
    tables: new Set(tables.map((row) => String(row.name))),
    constraints: new Set(constraints.map((row) => String(row.name))),
    indexes: new Set(indexes.map((row) => String(row.name))),
  };
}

function missingNames(expected: ReadonlySet<string>, actual: ReadonlySet<string>): string[] {
  return [...expected].filter((name) => !actual.has(name)).sort();
}

async function assertCompleteMigration(
  connection: mysql.Connection,
  expected: MigrationShape,
): Promise<void> {
  const actual = await persistedMigrationShape(connection);
  const missing = {
    tables: missingNames(expected.tables, actual.tables),
    constraints: missingNames(expected.constraints, actual.constraints),
    indexes: missingNames(expected.indexes, actual.indexes),
  };

  if (missing.tables.length || missing.constraints.length || missing.indexes.length) {
    throw new Error(`Tenant RBAC migration is structurally partial: ${JSON.stringify(missing)}`);
  }
}

async function applyMigration(connection: mysql.Connection): Promise<void> {
  const migration = await readFile(migrationUrl, "utf8");
  const expected = expectedMigrationShape(migration);
  const existing = await persistedMigrationShape(connection);
  const existingMigrationTables = [...expected.tables].filter((name) => existing.tables.has(name));

  if (existingMigrationTables.length > 0) {
    await assertCompleteMigration(connection, expected);
    return;
  }

  for (const statement of migration
    .split("--> statement-breakpoint")
    .map((value) => value.trim())
    .filter(Boolean)) {
    await connection.query(statement);
  }

  await assertCompleteMigration(connection, expected);
}

async function expectIntegrityFailure(operation: Promise<unknown>): Promise<void> {
  await assert.rejects(operation, (error: unknown) => {
    const errno = (error as { errno?: number }).errno ?? 0;
    return [1062, 1452, 3819, 4025].includes(errno);
  });
}

async function createTenant(
  connection: mysql.Connection,
  tenantId: string,
  applicationId: string,
  ownerUserId: string,
  bindingId: string,
  npsn: string,
): Promise<void> {
  await connection.execute(
    "INSERT INTO `applicant_school_binding` (`id`,`user_id`,`canonical_npsn`,`created_at`) VALUES (?,?,?,NOW(3))",
    [bindingId, ownerUserId, npsn],
  );
  await connection.execute(
    "INSERT INTO `simas_application` (`id`,`school_name`,`npsn`,`education_level`,`address`,`contact_name`,`contact_position`,`contact_email`,`contact_whatsapp`,`status`,`submitted_at`,`owner_user_id`,`binding_id`,`attempt_number`,`idempotency_key`,`payload_hash`) VALUES (?, 'Sekolah RBAC', ?, 'SMA', 'Alamat', 'Kontak', 'Operator', ?, '0812', 'pending', NOW(3),?,?,1,?,REPEAT('a',64))",
    [applicationId, npsn, `${applicationId}@test.invalid`, ownerUserId, bindingId, randomUUID()],
  );
  await connection.execute(
    "INSERT INTO `tenant` (`id`,`name`,`domain`,`npsn`,`source_application_id`,`approved_at`,`operational_status`,`created_at`,`updated_at`) VALUES (?, 'Sekolah RBAC', ?, ?, ?, NOW(3), 'active', NOW(3), NOW(3))",
    [tenantId, `rbac-${tenantId}`, npsn, applicationId],
  );
}

mysqlTest("MySQL enforces Tenant-qualified RBAC, lifecycle, and audit persistence", async () => {
  let connection: mysql.Connection | undefined;
  let racer: mysql.Connection | undefined;
  let migrationReady = false;
  const ids = {
    tenantA: randomUUID(),
    tenantB: randomUUID(),
    applicationA: randomUUID(),
    applicationB: randomUUID(),
    bindingA: randomUUID(),
    bindingB: randomUUID(),
    adminA: randomUUID(),
    memberA: randomUUID(),
    secondAdminA: randomUUID(),
    memberB: randomUUID(),
    provider: randomUUID(),
    roleA: randomUUID(),
    roleB: randomUUID(),
    assignment: randomUUID(),
    authorityA: randomUUID(),
    authorityA2: randomUUID(),
    proof: randomUUID(),
    command: randomUUID(),
    event: randomUUID(),
    person: randomUUID(),
  };
  const migrationKey = `tenant-rbac-${randomUUID()}`;
  const commandIdempotencyKey = randomUUID();
  const outboxEventKey = randomUUID();
  const hash = "a".repeat(64);

  try {
    connection = await mysql.createConnection(databaseUrl!);
    await connection.query("SET SESSION lock_wait_timeout=10");
    await connection.query("SET SESSION innodb_lock_wait_timeout=10");
    await applyMigration(connection);
    migrationReady = true;

    racer = await mysql.createConnection(databaseUrl!);
    await racer.query("SET SESSION lock_wait_timeout=10");
    await racer.query("SET SESSION innodb_lock_wait_timeout=10");

    await connection.execute(
      "INSERT INTO `user` (`id`,`name`,`email`,`email_verified`,`created_at`,`updated_at`) VALUES (?,'Admin A',?,false,NOW(3),NOW(3)),(?,'Member B',?,false,NOW(3),NOW(3))",
      [ids.adminA, `${ids.adminA}@test.invalid`, ids.memberB, `${ids.memberB}@test.invalid`],
    );
    const npsnA = String(91000000 + (Number.parseInt(ids.tenantA.replaceAll("-", "").slice(-6), 16) % 1_000_000));
    const npsnB = String(91000000 + (Number.parseInt(ids.tenantB.replaceAll("-", "").slice(-6), 16) % 1_000_000));
    await createTenant(connection, ids.tenantA, ids.applicationA, ids.adminA, ids.bindingA, npsnA);
    await createTenant(connection, ids.tenantB, ids.applicationB, ids.memberB, ids.bindingB, npsnB);
    await connection.execute("UPDATE `user` SET `tenant_id`=?,`tenant_role`='school-admin' WHERE `id`=?", [ids.tenantA, ids.adminA]);
    await connection.execute("UPDATE `user` SET `tenant_id`=?,`tenant_role`='guest' WHERE `id`=?", [ids.tenantB, ids.memberB]);
    await connection.execute(
      "INSERT INTO `user` (`id`,`tenant_id`,`tenant_role`,`name`,`email`,`email_verified`,`created_at`,`updated_at`) VALUES (?,?,'staff','Member A',?,false,NOW(3),NOW(3)),(?,?,'school-admin','Admin A2',?,false,NOW(3),NOW(3)),(?,NULL,NULL,'Provider',?,false,NOW(3),NOW(3))",
      [
        ids.memberA, ids.tenantA, `${ids.memberA}@test.invalid`,
        ids.secondAdminA, ids.tenantA, `${ids.secondAdminA}@test.invalid`,
        ids.provider, `${ids.provider}@test.invalid`,
      ],
    );
    await connection.execute("INSERT INTO `provider_admin` (`user_id`,`created_at`) VALUES (?,NOW(3))", [ids.provider]);

    await connection.execute(
      "INSERT INTO `tenant_role` (`id`,`tenant_id`,`name`,`normalized_name`,`lifecycle`,`origin`,`version`,`created_at`,`updated_at`) VALUES (?,?,'Operator','operator','active','scratch',1,NOW(3),NOW(3)),(?,?,'Operator','operator','active','scratch',1,NOW(3),NOW(3))",
      [ids.roleA, ids.tenantA, ids.roleB, ids.tenantB],
    );
    await expectIntegrityFailure(connection.execute(
      "INSERT INTO `tenant_role` (`id`,`tenant_id`,`name`,`normalized_name`,`lifecycle`,`origin`,`version`,`created_at`,`updated_at`) VALUES (?,?,'OPERATOR','operator','draft','scratch',1,NOW(3),NOW(3))",
      [randomUUID(), ids.tenantA],
    ));

    const raceName = `race-${randomUUID()}`;
    const roleRace = await Promise.allSettled([
      connection.execute(
        "INSERT INTO `tenant_role` (`id`,`tenant_id`,`name`,`normalized_name`,`lifecycle`,`origin`,`version`,`created_at`,`updated_at`) VALUES (?,?,?,?,'draft','scratch',1,NOW(3),NOW(3))",
        [randomUUID(), ids.tenantA, raceName, raceName],
      ),
      racer.execute(
        "INSERT INTO `tenant_role` (`id`,`tenant_id`,`name`,`normalized_name`,`lifecycle`,`origin`,`version`,`created_at`,`updated_at`) VALUES (?,?,?,?,'draft','scratch',1,NOW(3),NOW(3))",
        [randomUUID(), ids.tenantA, raceName, raceName],
      ),
    ]);
    assert.equal(roleRace.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(roleRace.filter((result) => result.status === "rejected").length, 1);

    await connection.execute(
      "INSERT INTO `tenant_role_permission` (`tenant_id`,`role_id`,`permission_key`,`created_at`) VALUES (?,?, 'tenant.dashboard.view', NOW(3))",
      [ids.tenantA, ids.roleA],
    );
    await expectIntegrityFailure(connection.execute(
      "INSERT INTO `tenant_role_permission` (`tenant_id`,`role_id`,`permission_key`,`created_at`) VALUES (?,?, 'Tenant.bad.key', NOW(3))",
      [ids.tenantA, ids.roleA],
    ));
    await connection.execute(
      "INSERT INTO `tenant_role_assignment` (`id`,`tenant_id`,`user_id`,`role_id`,`state`,`version`,`assigned_at`,`updated_at`) VALUES (?,?,?,?, 'active',1,NOW(3),NOW(3))",
      [ids.assignment, ids.tenantA, ids.memberA, ids.roleA],
    );
    await expectIntegrityFailure(connection.execute(
      "INSERT INTO `tenant_role_assignment` (`id`,`tenant_id`,`user_id`,`role_id`,`state`,`version`,`assigned_at`,`updated_at`) VALUES (?,?,?,?, 'active',1,NOW(3),NOW(3))",
      [randomUUID(), ids.tenantA, ids.memberA, ids.roleB],
    ));
    await expectIntegrityFailure(connection.execute(
      "INSERT INTO `tenant_role_assignment` (`id`,`tenant_id`,`user_id`,`role_id`,`state`,`version`,`assigned_at`,`updated_at`) VALUES (?,?,?,?, 'active',1,NOW(3),NOW(3))",
      [randomUUID(), ids.tenantA, ids.memberA, ids.roleA],
    ));
    await connection.execute(
      "UPDATE `tenant_role_assignment` SET `state`='suspended',`suspended_at`=NOW(3),`version`=2,`updated_at`=NOW(3) WHERE `id`=?",
      [ids.assignment],
    );

    await connection.execute(
      "INSERT INTO `tenant_account_security` (`tenant_id`,`user_id`,`lifecycle`,`version`,`assignment_version`,`activated_at`,`created_at`,`updated_at`) VALUES (?,?,'active',1,1,NOW(3),NOW(3),NOW(3))",
      [ids.tenantA, ids.memberA],
    );
    await expectIntegrityFailure(connection.execute(
      "INSERT INTO `tenant_account_security` (`tenant_id`,`user_id`,`lifecycle`,`version`,`assignment_version`,`activated_at`,`created_at`,`updated_at`) VALUES (?,?,'active',1,1,NOW(3),NOW(3),NOW(3))",
      [ids.tenantB, ids.memberA],
    ));
    await connection.execute(
      "INSERT INTO `tenant_account_lifecycle_case` (`id`,`tenant_id`,`user_id`,`kind`,`state`,`delivery_channel`,`secret_digest`,`expires_at`,`delivery_attempts`,`version`,`idempotency_key`,`created_at`,`updated_at`) VALUES (?,?,?,'activation','pending','email',REPEAT('b',64),DATE_ADD(NOW(3),INTERVAL 1 DAY),0,1,?,NOW(3),NOW(3))",
      [randomUUID(), ids.tenantA, ids.memberA, randomUUID()],
    );
    await expectIntegrityFailure(connection.execute(
      "INSERT INTO `tenant_account_lifecycle_case` (`id`,`tenant_id`,`user_id`,`kind`,`state`,`delivery_channel`,`secret_digest`,`expires_at`,`delivery_attempts`,`version`,`idempotency_key`,`created_at`,`updated_at`) VALUES (?,?,?,'activation','pending','email',REPEAT('b',64),DATE_ADD(NOW(3),INTERVAL 1 DAY),0,1,?,NOW(3),NOW(3))",
      [randomUUID(), ids.tenantA, ids.memberA, randomUUID()],
    ));

    await connection.execute(
      "INSERT INTO `school_admin_authority` (`id`,`tenant_id`,`user_id`,`authority_state`,`version`,`granted_at`,`created_at`,`updated_at`) VALUES (?,?,?,'active',1,NOW(3),NOW(3),NOW(3)),(?,?,?,'active',1,NOW(3),NOW(3),NOW(3))",
      [ids.authorityA, ids.tenantA, ids.adminA, ids.authorityA2, ids.tenantA, ids.secondAdminA],
    );
    const [activeAdmins] = await connection.execute<mysql.RowDataPacket[]>(
      "SELECT COUNT(*) AS `count` FROM `school_admin_authority` WHERE `tenant_id`=? AND `authority_state`='active'",
      [ids.tenantA],
    );
    assert.equal(activeAdmins[0].count, 2);
    await expectIntegrityFailure(connection.execute(
      "INSERT INTO `school_admin_authority` (`id`,`tenant_id`,`user_id`,`authority_state`,`version`,`granted_at`,`created_at`,`updated_at`) VALUES (?,?,?,'active',1,NOW(3),NOW(3),NOW(3))",
      [randomUUID(), ids.tenantB, ids.adminA],
    ));
    await connection.execute(
      "INSERT INTO `school_admin_proof` (`id`,`tenant_id`,`authority_id`,`case_id`,`kind`,`proof_state`,`secret_digest`,`expires_at`,`version`,`idempotency_key`,`created_at`,`updated_at`) VALUES (?,?,?,?,'nomination','pending',REPEAT('c',64),DATE_ADD(NOW(3),INTERVAL 1 DAY),1,?,NOW(3),NOW(3))",
      [ids.proof, ids.tenantA, ids.authorityA, randomUUID(), randomUUID()],
    );
    await expectIntegrityFailure(connection.execute(
      "INSERT INTO `school_admin_proof` (`id`,`tenant_id`,`authority_id`,`case_id`,`kind`,`proof_state`,`secret_digest`,`expires_at`,`version`,`idempotency_key`,`created_at`,`updated_at`) VALUES (?,?,?,?,'nomination','pending',REPEAT('c',64),DATE_ADD(NOW(3),INTERVAL 1 DAY),1,?,NOW(3),NOW(3))",
      [randomUUID(), ids.tenantA, ids.authorityA, randomUUID(), randomUUID()],
    ));

    await connection.execute(
      "INSERT INTO `school_person` (`id`,`tenant_id`,`full_name`,`normalized_name`,`birth_place`,`normalized_birth_place`,`birth_date`,`gender`,`street`,`account_user_id`,`archived`,`version`,`created_at`,`updated_at`) VALUES (?,?,'Member A','member a','Palu','palu','2000-01-01','male','Alamat',?,false,1,NOW(3),NOW(3))",
      [ids.person, ids.tenantA, ids.memberA],
    );
    await expectIntegrityFailure(connection.execute(
      "INSERT INTO `school_person` (`id`,`tenant_id`,`full_name`,`normalized_name`,`birth_place`,`normalized_birth_place`,`birth_date`,`gender`,`street`,`account_user_id`,`archived`,`version`,`created_at`,`updated_at`) VALUES (?,?, 'Duplikat','duplikat','Palu','palu','2000-01-01','male','Alamat',?,false,1,NOW(3),NOW(3))",
      [randomUUID(), ids.tenantA, ids.memberA],
    ));
    await expectIntegrityFailure(connection.execute(
      "INSERT INTO `school_person` (`id`,`tenant_id`,`full_name`,`normalized_name`,`birth_place`,`normalized_birth_place`,`birth_date`,`gender`,`street`,`account_user_id`,`archived`,`version`,`created_at`,`updated_at`) VALUES (?,?, 'Lintas','lintas','Palu','palu','2000-01-01','male','Alamat',?,false,1,NOW(3),NOW(3))",
      [randomUUID(), ids.tenantB, ids.memberA],
    ));

    await connection.execute(
      "INSERT INTO `security_command` (`id`,`security_context_kind`,`context_id`,`tenant_id`,`idempotency_key`,`command_name`,`fingerprint`,`status`,`created_at`) VALUES (?,'tenant',?,?,?,'tenant-role.test',?,'pending',NOW(3))",
      [ids.command, ids.tenantA, ids.tenantA, commandIdempotencyKey, hash],
    );
    await expectIntegrityFailure(connection.execute(
      "INSERT INTO `security_command` (`id`,`security_context_kind`,`context_id`,`tenant_id`,`idempotency_key`,`command_name`,`fingerprint`,`status`,`created_at`) VALUES (?,'tenant',?,?,?,'tenant-role.retry',?,'pending',NOW(3))",
      [randomUUID(), ids.tenantA, ids.tenantA, commandIdempotencyKey, hash],
    ));
    await expectIntegrityFailure(connection.execute(
      "INSERT INTO `security_command` (`id`,`security_context_kind`,`context_id`,`tenant_id`,`idempotency_key`,`command_name`,`fingerprint`,`status`,`created_at`) VALUES (?,'tenant',?,?,?,'bad-context',?,'pending',NOW(3))",
      [randomUUID(), ids.tenantA, ids.tenantB, randomUUID(), hash],
    ));
    await connection.execute(
      "INSERT INTO `security_outbox` (`id`,`security_context_kind`,`context_id`,`tenant_id`,`command_id`,`event_key`,`event_type`,`payload`,`occurred_at`,`available_at`) VALUES (?,'tenant',?,?,?,?,'security.test',JSON_OBJECT(),NOW(3),NOW(3))",
      [randomUUID(), ids.tenantA, ids.tenantA, ids.command, outboxEventKey],
    );
    await expectIntegrityFailure(connection.execute(
      "INSERT INTO `security_outbox` (`id`,`security_context_kind`,`context_id`,`tenant_id`,`command_id`,`event_key`,`event_type`,`payload`,`occurred_at`,`available_at`) VALUES (?,'tenant',?,?,?,?,'security.test',JSON_OBJECT(),NOW(3),NOW(3))",
      [randomUUID(), ids.tenantA, ids.tenantA, ids.command, outboxEventKey],
    ));
    await expectIntegrityFailure(connection.execute(
      "INSERT INTO `security_outbox` (`id`,`security_context_kind`,`context_id`,`tenant_id`,`command_id`,`event_key`,`event_type`,`payload`,`occurred_at`,`available_at`) VALUES (?,'tenant',?,?,?,?,'security.test',JSON_OBJECT(),NOW(3),NOW(3))",
      [randomUUID(), ids.tenantB, ids.tenantB, ids.command, randomUUID()],
    ));

    await connection.execute(
      "INSERT INTO `security_audit_head` (`security_context_kind`,`context_id`,`tenant_id`,`next_sequence`,`head_hash`,`version`,`updated_at`) VALUES ('tenant',?,?,1,?,1,NOW(3))",
      [ids.tenantA, ids.tenantA, hash],
    );
    const insertEvent = (database: mysql.Connection, eventId: string, eventKey: string, sequence: number, roleId: string) => database.execute(
      "INSERT INTO `security_audit_event` (`id`,`security_context_kind`,`context_id`,`tenant_id`,`sequence`,`event_key`,`schema_version`,`event_type`,`outcome`,`actor_kind`,`actor_provider_user_id`,`command_id`,`target_role_id`,`correlation_id`,`metadata`,`canonical_payload_digest`,`previous_hash`,`event_hash`,`occurred_at`) VALUES (?,'tenant',?,?,?, ?,1,'tenant_role.created','succeeded','provider-admin',?,?,?, ?,JSON_OBJECT(),?,?,?,NOW(3))",
      [eventId, ids.tenantA, ids.tenantA, sequence, eventKey, ids.provider, ids.command, roleId, randomUUID(), hash, hash, hash],
    );
    await insertEvent(connection, ids.event, randomUUID(), 1, ids.roleA);
    await expectIntegrityFailure(insertEvent(connection, randomUUID(), randomUUID(), 2, ids.roleB));
    const eventRace = await Promise.allSettled([
      insertEvent(connection, randomUUID(), randomUUID(), 2, ids.roleA),
      insertEvent(racer, randomUUID(), randomUUID(), 2, ids.roleA),
    ]);
    assert.equal(eventRace.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(eventRace.filter((result) => result.status === "rejected").length, 1);


    await connection.execute(
      "INSERT INTO `tenant_rbac_rollout` (`tenant_id`,`http_mode`,`worker_mode`,`epoch`,`resolver_version`,`registry_version`,`operation_map_version`,`version`,`updated_at`) VALUES (?,'legacy','legacy',1,'legacy@1','tenant-permissions@1','tenant-operations@1',1,NOW(3))",
      [ids.tenantA],
    );
    await expectIntegrityFailure(connection.execute(
      "UPDATE `tenant_rbac_rollout` SET `http_mode`='rbac-emergency',`overlay_hash`=? WHERE `tenant_id`=?",
      [hash, ids.tenantA],
    ));
    await connection.execute(
      "UPDATE `tenant_rbac_rollout` SET `http_mode`='rbac-emergency',`worker_mode`='rbac-emergency',`overlay_hash`=?,`epoch`=2,`version`=2 WHERE `tenant_id`=?",
      [hash, ids.tenantA],
    );
    await connection.execute(
      "INSERT INTO `security_migration_checkpoint` (`migration_key`,`shard_key`,`state`,`registry_version`,`operation_map_version`,`examined_count`,`migrated_count`,`finding_count`,`version`,`updated_at`) VALUES (?, '00','pending','tenant-permissions@1','tenant-operations@1',0,0,0,1,NOW(3))",
      [migrationKey],
    );
    await connection.execute(
      "INSERT INTO `security_reconciliation_finding` (`id`,`migration_key`,`scope_key`,`finding_key`,`tenant_id`,`user_id`,`reason_code`,`severity`,`state`,`safe_details`,`detected_at`) VALUES (?,?,?,?,?,?,'unknown-legacy-role','blocking','open',JSON_OBJECT(),NOW(3))",
      [randomUUID(), migrationKey, ids.tenantA, randomUUID(), ids.tenantA, ids.memberA],
    );
    await expectIntegrityFailure(connection.execute(
      "INSERT INTO `security_reconciliation_finding` (`id`,`migration_key`,`scope_key`,`finding_key`,`tenant_id`,`user_id`,`reason_code`,`severity`,`state`,`safe_details`,`detected_at`) VALUES (?,?,?,?,NULL,?,'missing-tenant-context','blocking','open',JSON_OBJECT(),NOW(3))",
      [randomUUID(), migrationKey, "provider", randomUUID(), ids.memberA],
    ));

    await connection.execute("UPDATE `user` SET `tenant_role`='guru' WHERE `id`=?", [ids.memberA]);
    const [legacyRows] = await connection.execute<mysql.RowDataPacket[]>(
      "SELECT `tenant_id`,`tenant_role` FROM `user` WHERE `id`=?",
      [ids.memberA],
    );
    assert.deepEqual({ tenantId: legacyRows[0].tenant_id, tenantRole: legacyRows[0].tenant_role }, {
      tenantId: ids.tenantA,
      tenantRole: "guru",
    });
  } finally {
    try {
      if (migrationReady && connection) {
        await connection.execute("SET FOREIGN_KEY_CHECKS=0");
        for (const table of [
          "security_audit_event",
          "security_outbox",
          "school_admin_proof",
          "tenant_role_assignment",
          "tenant_role_permission",
          "school_admin_authority",
          "tenant_account_lifecycle_case",
          "tenant_account_security",
          "tenant_rbac_rollout",
          "security_reconciliation_finding",
          "security_command",
          "security_audit_head",
          "tenant_role",
          "school_person",
        ]) {
          await connection.query(`DELETE FROM \`${table}\` WHERE \`tenant_id\` IN (?,?)`, [ids.tenantA, ids.tenantB]);
        }
        await connection.execute("DELETE FROM `security_migration_checkpoint` WHERE `migration_key`=?", [migrationKey]);
        await connection.execute("DELETE FROM `user` WHERE `tenant_id` IN (?,?)", [ids.tenantA, ids.tenantB]);
        await connection.execute("DELETE FROM `tenant` WHERE `id` IN (?,?)", [ids.tenantA, ids.tenantB]);
        await connection.execute("DELETE FROM `simas_application` WHERE `id` IN (?,?)", [ids.applicationA, ids.applicationB]);
        await connection.execute("DELETE FROM `applicant_school_binding` WHERE `id` IN (?,?)", [ids.bindingA, ids.bindingB]);
        await connection.execute("DELETE FROM `provider_admin` WHERE `user_id`=?", [ids.provider]);
        await connection.execute("DELETE FROM `user` WHERE `id`=?", [ids.provider]);
        await connection.execute("SET FOREIGN_KEY_CHECKS=1");
      }
    } finally {
      await Promise.allSettled([racer?.end(), connection?.end()]);
    }
  }
});
