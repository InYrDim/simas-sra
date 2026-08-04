import "dotenv/config";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after } from "node:test";

import mysql from "mysql2/promise";

import { closeDatabasePool } from "@/db";
import {
  createConsumeTenantLifecycleCaseService,
  createTenantAccountLifecycleDataService,
} from "@/lib/authorization/tenant-account-lifecycle-data";
import {

  digestLifecycleSecret,
  type LifecycleCaseKind,
} from "@/lib/authorization/tenant-account-lifecycle";
import { SecurityCommandError } from "@/lib/authorization/security-command";
import { deliverPendingLifecycleEvents } from "@/lib/tenancy/tenant-account-lifecycle-delivery";

const databaseUrl = process.env.DATABASE_URL;
const lifecycleKey = process.env.TENANT_ACCOUNT_LIFECYCLE_SECRET_KEY;
const mysqlTest = databaseUrl && lifecycleKey ? test : test.skip;
const service = createTenantAccountLifecycleDataService();
const principal = (userId: string) => ({ kind: "authenticated-user" as const, userId });

after(() => closeDatabasePool());

function commandIds() {
  return { idempotencyKey: randomUUID(), correlationId: randomUUID() };
}

function expectDenied(operation: Promise<unknown>): Promise<void> {
  return assert.rejects(operation, (error: unknown) => error instanceof SecurityCommandError && error.code === "context-denied");
}

async function setup(connection: mysql.Connection) {
  const ids = {
    tenant: randomUUID(),
    tenantB: randomUUID(),
    admin: randomUUID(),
    adminB: randomUUID(),
    provider: randomUUID(),
    applicant: randomUUID(),
    schoolAdminTarget: randomUUID(),
    roleA: randomUUID(),
    roleB: randomUUID(),
    assignmentA: randomUUID(),
    assignmentB: randomUUID(),
    session: randomUUID(),
    person: randomUUID(),
    application: randomUUID(),
    applicationB: randomUUID(),
  };

  await connection.execute("SET FOREIGN_KEY_CHECKS=0");
  const npsnA = String(91000000 + (Number.parseInt(ids.tenant.replaceAll("-", "").slice(-6), 16) % 1_000_000));
  const npsnB = String(91000000 + (Number.parseInt(ids.tenantB.replaceAll("-", "").slice(-6), 16) % 1_000_000));
  await connection.execute(
    "INSERT INTO `tenant` (`id`,`name`,`domain`,`npsn`,`source_application_id`,`approved_at`,`operational_status`,`created_at`,`updated_at`) VALUES (?, 'Lifecycle A', ?, ?, ?, NOW(3), 'active', NOW(3), NOW(3)), (?, 'Lifecycle B', ?, ?, ?, NOW(3), 'active', NOW(3), NOW(3))",
    [ids.tenant, `lifecycle-${ids.tenant}`, npsnA, ids.application, ids.tenantB, `lifecycle-${ids.tenantB}`, npsnB, ids.applicationB],
  );
  await connection.execute(
    "INSERT INTO `user` (`id`,`tenant_id`,`tenant_role`,`name`,`email`,`email_verified`,`created_at`,`updated_at`) VALUES (?,?,'school-admin','Admin A',?,true,NOW(3),NOW(3)), (?,?,'school-admin','Admin B',?,true,NOW(3),NOW(3)), (?,?,'school-admin','Target Admin',?,true,NOW(3),NOW(3)), (?,?,NULL,'Provider',?,false,NOW(3),NOW(3)), (?,?,NULL,'Applicant',?,false,NOW(3),NOW(3))",
    [ids.admin, ids.tenant, `${ids.admin}@test.invalid`, ids.adminB, ids.tenantB, `${ids.adminB}@test.invalid`, ids.schoolAdminTarget, ids.tenant, `${ids.schoolAdminTarget}@test.invalid`, ids.provider, null, `${ids.provider}@test.invalid`, ids.applicant, null, `${ids.applicant}@test.invalid`],
  );
  await connection.execute("INSERT INTO `provider_admin` (`user_id`,`created_at`) VALUES (?,NOW(3))", [ids.provider]);
  await connection.execute("INSERT INTO `applicant` (`user_id`,`created_at`) VALUES (?,NOW(3))", [ids.applicant]);
  await connection.execute(
    "INSERT INTO `school_admin_authority` (`id`,`tenant_id`,`user_id`,`authority_state`,`version`,`granted_at`,`created_at`,`updated_at`) VALUES (?,?,?,'active',1,NOW(3),NOW(3),NOW(3))",
    [randomUUID(), ids.tenant, ids.schoolAdminTarget],
  );
  await connection.execute(
    "INSERT INTO `tenant_role` (`id`,`tenant_id`,`name`,`normalized_name`,`lifecycle`,`origin`,`version`,`created_at`,`updated_at`) VALUES (?,?,'Role A','role a','active','scratch',1,NOW(3),NOW(3)), (?,?,'Role B','role b','active','scratch',1,NOW(3),NOW(3))",
    [ids.roleA, ids.tenant, ids.roleB, ids.tenant],
  );
  await connection.execute(
    "INSERT INTO `school_person` (`id`,`tenant_id`,`full_name`,`normalized_name`,`birth_place`,`normalized_birth_place`,`birth_date`,`gender`,`street`,`archived`,`version`,`created_at`,`updated_at`) VALUES (?,?, 'Person A','person a','Kota','kota','2000-01-01','female','Jalan A',false,2,NOW(3),NOW(3))",
    [ids.person, ids.tenant],
  );
  await connection.execute("SET FOREIGN_KEY_CHECKS=1");
  return ids;
}

async function cleanup(connection: mysql.Connection, ids: Awaited<ReturnType<typeof setup>>) {
  await connection.execute("SET FOREIGN_KEY_CHECKS=0");
  for (const table of [
    "security_audit_event",
    "security_outbox",
    "security_command",
    "security_audit_head",
    "tenant_account_lifecycle_case",
    "tenant_role_assignment",
    "tenant_account_security",
    "school_admin_authority",
    "school_person",
    "tenant_role",
  ]) {
    await connection.execute(`DELETE FROM \`${table}\` WHERE tenant_id IN (?,?)`, [ids.tenant, ids.tenantB]);
  }
  await connection.execute("DELETE FROM `session` WHERE `user_id` IN (SELECT `id` FROM `user` WHERE `tenant_id` IN (?,?))", [ids.tenant, ids.tenantB]);
  await connection.execute("DELETE FROM `account` WHERE `user_id` IN (SELECT `id` FROM `user` WHERE `tenant_id` IN (?,?))", [ids.tenant, ids.tenantB]);
  await connection.execute("DELETE FROM `provider_admin` WHERE `user_id`=?", [ids.provider]);
  await connection.execute("DELETE FROM `applicant` WHERE `user_id`=?", [ids.applicant]);
  await connection.execute("DELETE FROM `user` WHERE `tenant_id` IN (?,?) OR `id` IN (?,?)", [ids.tenant, ids.tenantB, ids.provider, ids.applicant]);
  await connection.execute("DELETE FROM `tenant` WHERE id IN (?,?)", [ids.tenant, ids.tenantB]);
  await connection.execute("SET FOREIGN_KEY_CHECKS=1");
}

async function row<T extends mysql.RowDataPacket = mysql.RowDataPacket>(connection: mysql.Connection, sql: string, values: string[]) {
  const [rows] = await connection.execute<T[]>(sql, values);
  return rows[0];
}

async function lifecycleCase(connection: mysql.Connection, caseId: string) {
  return row(connection, "SELECT `state`,`secret_digest`,`expires_at`,`delivery_attempts` FROM `tenant_account_lifecycle_case` WHERE `id`=?", [caseId]);
}

async function issueActivationCase(tenantId: string, adminId: string, targetUserId: string, expectedVersion: number, mode: "resend" | "reissue", deliveryChannel: "email" | "temporary-credential", key = randomUUID()) {
  return service.issueActivation({
    principal: principal(adminId),
    tenantId,
    targetUserId,
    expectedVersion,
    deliveryChannel,
    mode,
    ...commandIds(),
    idempotencyKey: key,
  });
}

mysqlTest("MySQL account lifecycle races, replay, isolation, rollback, and outbox retry", async (t) => {
  process.env.APP_URL ??= "http://localhost:3000";
  const connection = await mysql.createConnection({ uri: databaseUrl!, timezone: "Z" });
  let ids: Awaited<ReturnType<typeof setup>>;
  try {
    ids = await setup(connection);
  } catch (error) {
    await connection.end();
    throw error;
  }

  t.after(async () => {
    await cleanup(connection, ids);
    await connection.end();
  });

  let created: { status: string; caseId: string | null; targetUserId: string; version: number };
  try {
    created = await service.create({
      principal: principal(ids.admin),
      tenantId: ids.tenant,
      name: "Lifecycle User",
      email: `${randomUUID()}@test.invalid`,
      deliveryChannel: "temporary-credential",
      ...commandIds(),
    });
  } catch (error) {
    throw error;
  }
  assert.equal(created.status, "created");
  const firstCase = await lifecycleCase(connection, created.caseId!);
  const resent = await issueActivationCase(ids.tenant, ids.admin, created.targetUserId, created.version, "resend", "temporary-credential");
  const resentCase = await lifecycleCase(connection, resent.caseId);
  assert.equal(resent.caseId, created.caseId);
  assert.equal(resentCase.secret_digest, firstCase.secret_digest);
  assert.equal(new Date(resentCase.expires_at).getTime(), new Date(firstCase.expires_at).getTime());

  const reissued = await issueActivationCase(ids.tenant, ids.admin, created.targetUserId, created.version, "reissue", "temporary-credential");
  assert.notEqual(reissued.caseId, created.caseId);
  assert.equal((await lifecycleCase(connection, created.caseId!)).state, "revoked");

  const consume = createConsumeTenantLifecycleCaseService();
  const reissuedCase = await lifecycleCase(connection, reissued.caseId);
  assert.ok(reissued.secret);
  const digestFromDatabaseExpiry = digestLifecycleSecret({ purpose: "activation", tenantId: ids.tenant, userId: created.targetUserId, expiresAt: new Date(reissuedCase.expires_at), secret: reissued.secret });
  assert.equal(reissuedCase.secret_digest, digestFromDatabaseExpiry);
  const consumed = await consume({ tenantId: ids.tenant, caseId: reissued.caseId, secret: reissued.secret, ...commandIds() });
  assert.equal(consumed.status, "activated");
  await expectDenied(consume({ tenantId: ids.tenant, caseId: reissued.caseId, secret: reissued.secret, ...commandIds() }));

  const idempotencyKey = randomUUID();
  const idempotentInput = { principal: principal(ids.admin), tenantId: ids.tenant, name: "Idempotent", email: `${randomUUID()}@test.invalid`, deliveryChannel: "temporary-credential" as const, idempotencyKey, correlationId: randomUUID() };
  const duplicate = await service.create(idempotentInput);
  const replay = await service.create({ ...idempotentInput, correlationId: randomUUID() });
  assert.deepEqual(replay, duplicate);

  const collisionEmail = `${randomUUID()}@test.invalid`;
  const races = await Promise.allSettled([
    service.create({ principal: principal(ids.admin), tenantId: ids.tenant, name: "Race A", email: collisionEmail, deliveryChannel: "temporary-credential", ...commandIds() }),
    service.create({ principal: principal(ids.admin), tenantId: ids.tenant, name: "Race B", email: collisionEmail, deliveryChannel: "temporary-credential", ...commandIds() }),
  ]);
  assert.equal(races.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(races.filter((result) => result.status === "rejected").length, 1);

  for (const email of [
    `${ids.adminB}@test.invalid`,
    `${ids.provider}@test.invalid`,
    `${ids.applicant}@test.invalid`,
  ]) {
    await expectDenied(service.create({ principal: principal(ids.admin), tenantId: ids.tenant, name: "Collision", email, deliveryChannel: "temporary-credential", ...commandIds() }));
  }

  const rollbackEmail = `${randomUUID()}@test.invalid`;
  await assert.rejects(service.create({ principal: principal(ids.admin), tenantId: ids.tenant, name: "Rollback", email: rollbackEmail, personId: ids.person, deliveryChannel: "temporary-credential", ...commandIds() }));
  const rollbackUser = await row(connection, "SELECT `id` FROM `user` WHERE `email`=?", [rollbackEmail]);
  assert.equal(rollbackUser, undefined);

  const active = await service.create({ principal: principal(ids.admin), tenantId: ids.tenant, name: "Deactivation", email: `${randomUUID()}@test.invalid`, deliveryChannel: "administrative", ...commandIds() });
  await connection.execute("INSERT INTO `tenant_role_assignment` (`id`,`tenant_id`,`user_id`,`role_id`,`state`,`version`,`assigned_at`,`updated_at`) VALUES (?,?,?,?,'active',1,NOW(3),NOW(3)), (?,?,?,?,'active',1,NOW(3),NOW(3))", [ids.assignmentA, ids.tenant, active.targetUserId, ids.roleA, ids.assignmentB, ids.tenant, active.targetUserId, ids.roleB]);
  await connection.execute("INSERT INTO `session` (`id`,`expires_at`,`token`,`created_at`,`updated_at`,`user_id`) VALUES (?,DATE_ADD(NOW(3),INTERVAL 1 DAY),?,NOW(3),NOW(3),?)", [ids.session, randomUUID(), active.targetUserId]);
  const recovery = await service.initiateRecovery({ principal: principal(ids.admin), tenantId: ids.tenant, targetUserId: active.targetUserId, expectedVersion: active.version, deliveryChannel: "email", mode: "reissue", ...commandIds() });
  const deactivated = await service.deactivate({ principal: principal(ids.admin), tenantId: ids.tenant, targetUserId: active.targetUserId, expectedVersion: active.version, reason: "Tidak lagi bertugas", ...commandIds() });
  assert.equal(deactivated.status, "deactivated");
  assert.equal((await row(connection, "SELECT COUNT(*) AS `count` FROM `session` WHERE `user_id`=?", [active.targetUserId])).count, 0);
  assert.equal((await row(connection, "SELECT COUNT(*) AS `count` FROM `tenant_role_assignment` WHERE `user_id`=? AND `state`='suspended'", [active.targetUserId])).count, 2);
  assert.equal((await lifecycleCase(connection, recovery.caseId)).state, "revoked");

  const reactivated = await service.reactivate({ principal: principal(ids.admin), tenantId: ids.tenant, targetUserId: active.targetUserId, expectedVersion: deactivated.version, roleIds: [ids.roleA], reason: "Kembali bertugas", ...commandIds() });
  assert.deepEqual(reactivated.roleIds, [ids.roleA]);
  assert.equal((await row(connection, "SELECT `state` FROM `tenant_role_assignment` WHERE `id`=?", [ids.assignmentA])).state, "active");
  assert.equal((await row(connection, "SELECT `state` FROM `tenant_role_assignment` WHERE `id`=?", [ids.assignmentB])).state, "suspended");

  const schoolAdmin = await service.create({ principal: principal(ids.admin), tenantId: ids.tenant, name: "Admin Target", email: `${randomUUID()}@test.invalid`, deliveryChannel: "administrative", ...commandIds() });
  await connection.execute("UPDATE `user` SET `tenant_role`='school-admin' WHERE `id`=?", [schoolAdmin.targetUserId]);
  await connection.execute("UPDATE `tenant_account_security` SET `lifecycle`='active',`activated_at`=NOW(3) WHERE `user_id`=?", [schoolAdmin.targetUserId]);
  await expectDenied(service.deactivate({ principal: principal(ids.admin), tenantId: ids.tenant, targetUserId: schoolAdmin.targetUserId, expectedVersion: schoolAdmin.version, reason: "Reject", ...commandIds() }));
  await expectDenied(service.deactivate({ principal: principal(ids.admin), tenantId: ids.tenant, targetUserId: ids.adminB, expectedVersion: 1, reason: "Foreign id", ...commandIds() }));

  const deliveryAccount = await service.create({ principal: principal(ids.admin), tenantId: ids.tenant, name: "Delivery", email: `${randomUUID()}@test.invalid`, deliveryChannel: "email", ...commandIds() });
  const deliveryNow = new Date();
  const failed = await deliverPendingLifecycleEvents({ now: deliveryNow, send: async () => { throw new Error("adapter unavailable"); } });
  assert.equal(failed.length, 0);
  const failedCase = await lifecycleCase(connection, deliveryAccount.caseId!);
  assert.equal(failedCase.state, "pending");
  assert.equal(failedCase.delivery_attempts, 1);

  const retried = await deliverPendingLifecycleEvents({ now: new Date(deliveryNow.getTime() + 60 * 60_000), send: async () => undefined });
  assert.equal(retried.length, 1);
  const deliveredCase = await row(connection, "SELECT `published_at`,`attempts` FROM `security_outbox` WHERE JSON_UNQUOTE(JSON_EXTRACT(`payload`, '$.caseId'))=?", [deliveryAccount.caseId!]);
  assert.ok(deliveredCase.published_at);
  assert.equal(deliveredCase.attempts, 2);

  const expired = await service.initiateRecovery({ principal: principal(ids.admin), tenantId: ids.tenant, targetUserId: active.targetUserId, expectedVersion: reactivated.version, deliveryChannel: "temporary-credential", mode: "reissue", ...commandIds() });
  await connection.execute("UPDATE `tenant_account_lifecycle_case` SET `expires_at`=DATE_SUB(NOW(3), INTERVAL 1 MINUTE) WHERE `id`=?", [expired.caseId]);
  await expectDenied(consume({ tenantId: ids.tenant, caseId: expired.caseId, secret: "expired", ...commandIds() }));

  const kind: LifecycleCaseKind = "activation";
  assert.equal(kind, "activation");
});
