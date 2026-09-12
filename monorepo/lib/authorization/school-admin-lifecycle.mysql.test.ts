import "dotenv/config";

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after } from "node:test";

import mysql from "mysql2/promise";

import { closeDatabasePool } from "@/db";
import {
  createSchoolAdminLifecycleDataService,
} from "@/lib/authorization/school-admin-lifecycle-data";
import {
  SecurityCommandError,
} from "@/lib/authorization/security-command";
import type { SchoolAdminDisableResult } from "@/lib/authorization/school-admin-lifecycle";

const databaseUrl = process.env.DATABASE_URL;
const mysqlTest = databaseUrl ? test : test.skip;
after(() => closeDatabasePool());

const service = createSchoolAdminLifecycleDataService();

function principal(userId: string): { kind: "authenticated-user"; userId: string } {
  return { kind: "authenticated-user", userId };
}

/** Accepts MySQL constraint failures: duplicate key, FK violation, CHECK violation. */
async function expectIntegrityFailure(operation: Promise<unknown>): Promise<void> {
  await assert.rejects(operation, (error: unknown) => [1062, 1452, 3819, 4025].includes(integrityErrno(error)));
}

/** Reads `errno` from the error or from its wrapped `cause` chain (Drizzle wraps mysql2 errors). */
function integrityErrno(error: unknown): number {
  const seen = new Set<unknown>();
  let candidate = error as { errno?: number; cause?: unknown } | null;
  while (candidate && !seen.has(candidate)) {
    seen.add(candidate);
    if (typeof candidate.errno === "number") return candidate.errno;
    const next = candidate.cause as { errno?: number; cause?: unknown } | null | undefined;
    candidate = next ?? null;
  }
  return 0;
}

async function expectContextDenied(operation: Promise<unknown>): Promise<void> {
  await assert.rejects(
    operation,
    (error: unknown) => error instanceof SecurityCommandError && error.code === "context-denied",
  );
}

async function authorityRow(connection: mysql.Connection, authorityId: string) {
  const [rows] = await connection.execute<mysql.RowDataPacket[]>(
    "SELECT `tenant_id`,`user_id`,`authority_state`,`version`,`granted_at`,`disabled_at` FROM `school_admin_authority` WHERE `id`=?",
    [authorityId],
  );
  return rows[0] as mysql.RowDataPacket | undefined;
}

async function proofRow(connection: mysql.Connection, proofId: string) {
  const [rows] = await connection.execute<mysql.RowDataPacket[]>(
    "SELECT `tenant_id`,`authority_id`,`case_id`,`kind`,`proof_state`,`secret_digest`,`completed_at`,`version` FROM `school_admin_proof` WHERE `id`=?",
    [proofId],
  );
  return rows[0] as mysql.RowDataPacket | undefined;
}

async function tenantRole(connection: mysql.Connection, userId: string): Promise<string | null> {
  const [rows] = await connection.execute<mysql.RowDataPacket[]>(
    "SELECT `tenant_role` FROM `user` WHERE `id`=?",
    [userId],
  );
  return rows[0]?.tenant_role ?? null;
}

async function countSessions(connection: mysql.Connection, userId: string): Promise<number> {
  const [rows] = await connection.execute<mysql.RowDataPacket[]>(
    "SELECT COUNT(*) AS `count` FROM `session` WHERE `user_id`=?",
    [userId],
  );
  return Number(rows[0].count);
}

async function countActiveAuthorities(connection: mysql.Connection, tenantId: string): Promise<number> {
  const [rows] = await connection.execute<mysql.RowDataPacket[]>(
    "SELECT COUNT(*) AS `count` FROM `school_admin_authority` WHERE `tenant_id`=? AND `authority_state`='active'",
    [tenantId],
  );
  return Number(rows[0].count);
}

async function tenantEvents(connection: mysql.Connection, tenantId: string) {
  const [rows] = await connection.execute<mysql.RowDataPacket[]>(
    "SELECT `sequence`,`event_type`,`actor_kind`,`actor_provider_user_id`,`actor_tenant_user_id`,`target_school_admin_authority_id`,`target_school_admin_proof_id`,`correlation_id`,`metadata`,`previous_hash`,`event_hash` FROM `security_audit_event` WHERE `security_context_kind`='tenant' AND `context_id`=? ORDER BY `sequence`",
    [tenantId],
  );
  return rows as mysql.RowDataPacket[];
}

type Seed = Awaited<ReturnType<typeof setup>>;

async function setup(connection: mysql.Connection) {
  const ids = {
    tenant: randomUUID(),
    tenantB: randomUUID(),
    applicationA: randomUUID(),
    applicationB: randomUUID(),
    bindingA: randomUUID(),
    bindingB: randomUUID(),
    applicantBinding: randomUUID(),
    provider: randomUUID(),
    incumbent: randomUUID(),
    otherAdmin: randomUUID(),
    nominee: randomUUID(),
    secondNominee: randomUUID(),
    spare: randomUUID(),
    foreignUser: randomUUID(),
    applicant: randomUUID(),
    incumbentAuthority: randomUUID(),
    otherAuthority: randomUUID(),
    foreignAuthority: randomUUID(),
    sessionIncumbent: randomUUID(),
    sessionOther: randomUUID(),
  };
  const npsn = String(Math.floor(10_000_000 + Math.random() * 80_000_000));
  const npsnA = String(Number(npsn) + 1);
  const npsnB = String(Number(npsn) + 2);

  await connection.execute(
    "INSERT INTO `user` (`id`,`name`,`email`,`email_verified`,`created_at`,`updated_at`) VALUES (?,'Incumbent',?,false,NOW(3),NOW(3)),(?,'Other Admin',?,false,NOW(3),NOW(3)),(?,'Nominee',?,false,NOW(3),NOW(3)),(?,'Second Nominee',?,false,NOW(3),NOW(3)),(?,'Spare',?,false,NOW(3),NOW(3)),(?,'Provider',?,false,NOW(3),NOW(3)),(?,'Foreign',?,false,NOW(3),NOW(3)),(?,'Applicant',?,false,NOW(3),NOW(3))",
    [
      ids.incumbent, `${ids.incumbent}@test.invalid`,
      ids.otherAdmin, `${ids.otherAdmin}@test.invalid`,
      ids.nominee, `${ids.nominee}@test.invalid`,
      ids.secondNominee, `${ids.secondNominee}@test.invalid`,
      ids.spare, `${ids.spare}@test.invalid`,
      ids.provider, `${ids.provider}@test.invalid`,
      ids.foreignUser, `${ids.foreignUser}@test.invalid`,
      ids.applicant, `${ids.applicant}@test.invalid`,
    ],
  );
  await connection.execute("INSERT INTO `provider_admin` (`user_id`,`created_at`) VALUES (?,NOW(3))", [ids.provider]);
  await connection.execute("INSERT INTO `applicant` (`user_id`,`created_at`) VALUES (?,NOW(3))", [ids.applicant]);
  await connection.execute(
    "INSERT INTO `applicant_school_binding` (`id`,`user_id`,`canonical_npsn`,`created_at`) VALUES (?,?,?,NOW(3)),(?,?,?,NOW(3)),(?,?,?,NOW(3))",
    [ids.bindingA, ids.incumbent, npsnA, ids.bindingB, ids.foreignUser, npsnB, ids.applicantBinding, ids.applicant, npsn],
  );
  await connection.execute(
    "INSERT INTO `simas_application` (`id`,`school_name`,`npsn`,`education_level`,`address`,`contact_name`,`contact_position`,`contact_email`,`contact_whatsapp`,`status`,`submitted_at`,`owner_user_id`,`binding_id`,`attempt_number`,`idempotency_key`,`payload_hash`) VALUES (?,'Sekolah Lifecycle',?,'SMA','Alamat','Kontak','Operator',?,'0812','pending',NOW(3),?,?,1,?,REPEAT('a',64))",
    [ids.applicationA, npsnA, `${ids.applicationA}@test.invalid`, ids.incumbent, ids.bindingA, randomUUID()],
  );
  await connection.execute(
    "INSERT INTO `simas_application` (`id`,`school_name`,`npsn`,`education_level`,`address`,`contact_name`,`contact_position`,`contact_email`,`contact_whatsapp`,`status`,`submitted_at`,`owner_user_id`,`binding_id`,`attempt_number`,`idempotency_key`,`payload_hash`) VALUES (?,'Sekolah Lain',?,'SMA','Alamat','Kontak','Operator',?,'0812','pending',NOW(3),?,?,1,?,REPEAT('a',64))",
    [ids.applicationB, npsnB, `${ids.applicationB}@test.invalid`, ids.foreignUser, ids.bindingB, randomUUID()],
  );
  await connection.execute(
    "INSERT INTO `tenant` (`id`,`name`,`domain`,`npsn`,`source_application_id`,`approved_at`,`operational_status`,`created_at`,`updated_at`) VALUES (?,'Sekolah Lifecycle',?,?,?,NOW(3),'active',NOW(3),NOW(3))",
    [ids.tenant, `lifecycle-${ids.tenant}`, npsnA, ids.applicationA],
  );
  await connection.execute(
    "INSERT INTO `tenant` (`id`,`name`,`domain`,`npsn`,`source_application_id`,`approved_at`,`operational_status`,`created_at`,`updated_at`) VALUES (?,'Sekolah Lain',?,?,?,NOW(3),'active',NOW(3),NOW(3))",
    [ids.tenantB, `lifecycle-${ids.tenantB}`, npsnB, ids.applicationB],
  );
  await connection.execute(
    "UPDATE `user` SET `tenant_id`=?,`tenant_role`='school-admin' WHERE `id` IN (?,?)",
    [ids.tenant, ids.incumbent, ids.otherAdmin],
  );
  await connection.execute(
    "UPDATE `user` SET `tenant_id`=?,`tenant_role`='staff' WHERE `id` IN (?,?,?)",
    [ids.tenant, ids.nominee, ids.secondNominee, ids.spare],
  );
  await connection.execute(
    "UPDATE `user` SET `tenant_id`=?,`tenant_role`='staff' WHERE `id`=?",
    [ids.tenantB, ids.foreignUser],
  );
  await connection.execute(
    "INSERT INTO `school_admin_authority` (`id`,`tenant_id`,`user_id`,`authority_state`,`version`,`granted_at`,`disabled_at`,`created_at`,`updated_at`) VALUES (?,?,?,'active',1,NOW(3),NULL,NOW(3),NOW(3)),(?,?,?,'active',1,NOW(3),NULL,NOW(3),NOW(3))",
    [ids.incumbentAuthority, ids.tenant, ids.incumbent, ids.otherAuthority, ids.tenant, ids.otherAdmin],
  );
  await connection.execute(
    "INSERT INTO `school_admin_authority` (`id`,`tenant_id`,`user_id`,`authority_state`,`version`,`granted_at`,`disabled_at`,`created_at`,`updated_at`) VALUES (?,?,?,'active',1,NOW(3),NULL,NOW(3),NOW(3))",
    [ids.foreignAuthority, ids.tenantB, ids.foreignUser],
  );
  await connection.execute(
    "INSERT INTO `tenant_account_security` (`tenant_id`,`user_id`,`lifecycle`,`version`,`assignment_version`,`activated_at`,`created_at`,`updated_at`) VALUES (?,?,'active',1,1,NOW(3),NOW(3),NOW(3)),(?,?,'active',1,1,NOW(3),NOW(3),NOW(3))",
    [ids.tenant, ids.incumbent, ids.tenant, ids.otherAdmin],
  );
  await connection.execute(
    "INSERT INTO `session` (`id`,`expires_at`,`token`,`created_at`,`updated_at`,`user_id`) VALUES (?,DATE_ADD(NOW(3),INTERVAL 1 DAY),?,NOW(3),NOW(3),?),(?,DATE_ADD(NOW(3),INTERVAL 1 DAY),?,NOW(3),NOW(3),?)",
    [ids.sessionIncumbent, randomUUID(), ids.incumbent, ids.sessionOther, randomUUID(), ids.otherAdmin],
  );
  return ids;
}

async function cleanup(connection: mysql.Connection, ids: Seed): Promise<void> {
  const users = [
    ids.incumbent,
    ids.otherAdmin,
    ids.nominee,
    ids.secondNominee,
    ids.spare,
    ids.provider,
    ids.foreignUser,
    ids.applicant,
  ];
  await connection.execute("SET FOREIGN_KEY_CHECKS=0");
  for (const table of [
    "security_audit_event",
    "security_outbox",
    "school_admin_proof",
    "school_admin_authority",
    "tenant_account_security",
    "security_command",
    "security_audit_head",
  ]) {
    await connection.execute(`DELETE FROM \`${table}\` WHERE \`tenant_id\` IN (?,?)`, [ids.tenant, ids.tenantB]);
  }
  await connection.execute(
    "DELETE FROM `session` WHERE `user_id` IN (?,?,?,?,?,?,?,?)",
    users,
  );
  await connection.execute(
    "UPDATE `user` SET `tenant_id`=NULL,`tenant_role`=NULL WHERE `id` IN (?,?,?,?,?,?,?,?)",
    users,
  );
  await connection.execute("DELETE FROM `tenant` WHERE `id` IN (?,?)", [ids.tenant, ids.tenantB]);
  await connection.execute("DELETE FROM `simas_application` WHERE `id` IN (?,?)", [ids.applicationA, ids.applicationB]);
  await connection.execute(
    "DELETE FROM `applicant_school_binding` WHERE `id` IN (?,?,?)",
    [ids.bindingA, ids.bindingB, ids.applicantBinding],
  );
  await connection.execute("DELETE FROM `provider_admin` WHERE `user_id`=?", [ids.provider]);
  await connection.execute("DELETE FROM `applicant` WHERE `user_id`=?", [ids.applicant]);
  await connection.execute(
    "DELETE FROM `user` WHERE `id` IN (?,?,?,?,?,?,?,?)",
    users,
  );
  await connection.execute("SET FOREIGN_KEY_CHECKS=1");
}

async function withSetup(
  work: (connection: mysql.Connection, ids: Seed) => Promise<void>,
): Promise<void> {
  const connection = await mysql.createConnection(databaseUrl!);
  const ids = await setup(connection);
  try {
    await work(connection, ids);
  } finally {
    await cleanup(connection, ids);
    await connection.end();
  }
}

mysqlTest("MySQL persists the full canonical School Admin lifecycle with an atomic audit chain", async () => {
  await withSetup(async (connection, ids) => {
    const caseId = randomUUID();
    const correlations = [
      randomUUID(),
      randomUUID(),
      randomUUID(),
      randomUUID(),
      randomUUID(),
      randomUUID(),
      randomUUID(),
    ];
    const [nominationCorrelation, proofCorrelation, grantCorrelation, disableCorrelation, recoveryCorrelation, recoveryProofCorrelation, reactivateCorrelation] = correlations;

    const nomination = await service.nominateSchoolAdmin({
      principal: principal(ids.provider),
      tenantId: ids.tenant,
      email: `${ids.nominee}@test.invalid`,
      reason: "Penunjukan penanggung jawab sekolah",
      caseId,
      idempotencyKey: `nom-${randomUUID()}`,
      correlationId: nominationCorrelation,
    });
    assert.equal(nomination.status, "nomination-created");
    assert.equal(nomination.replacement, false);
    assert.equal(nomination.nomineeUserId, ids.nominee);
    assert.equal(nomination.proofState, "pending");

    let authority = await authorityRow(connection, nomination.authorityId);
    assert.ok(authority);
    assert.equal(authority.authority_state, "none");
    assert.equal(authority.version, 1);
    let proof = await proofRow(connection, nomination.proofId);
    assert.ok(proof);
    assert.equal(proof.proof_state, "pending");
    assert.equal(proof.kind, "nomination");
    assert.equal(proof.version, 1);

    // The nominee proves control of their own account; the authority stays none.
    const completed = await service.completeAccountControlProof({
      principal: principal(ids.nominee),
      tenantId: ids.tenant,
      caseId,
      expectedProofVersion: 1,
      secret: nomination.secret,
      idempotencyKey: `proof-${randomUUID()}`,
      correlationId: proofCorrelation,
    });
    assert.equal(completed.status, "proof-completed");
    assert.equal(completed.authorityState, "none");
    authority = await authorityRow(connection, nomination.authorityId);
    assert.equal(authority!.authority_state, "none");
    proof = await proofRow(connection, nomination.proofId);
    assert.equal(proof!.proof_state, "completed");
    assert.notEqual(proof!.completed_at, null);

    // Only the separate reauthenticated Provider command grants authority.
    const granted = await service.grantSchoolAdminAuthority({
      principal: principal(ids.provider),
      tenantId: ids.tenant,
      caseId,
      authorityId: nomination.authorityId,
      expectedAuthorityVersion: 1,
      expectedProofVersion: 2,
      reason: "Konfirmasi penunjukan penanggung jawab",
      idempotencyKey: `grant-${randomUUID()}`,
      correlationId: grantCorrelation,
    });
    assert.equal(granted.status, "granted");
    assert.equal(granted.activeCount, 3);
    authority = await authorityRow(connection, nomination.authorityId);
    assert.equal(authority!.authority_state, "active");
    assert.equal(authority!.version, 2);
    assert.equal(authority!.disabled_at, null);
    assert.equal(await tenantRole(connection, ids.nominee), "school-admin");

    // Disable: sessions are revoked, the role is cleared, and coverage stays ≥ 1.
    await connection.execute(
      "INSERT INTO `session` (`id`,`expires_at`,`token`,`created_at`,`updated_at`,`user_id`) VALUES (?,DATE_ADD(NOW(3),INTERVAL 1 DAY),?,NOW(3),NOW(3),?)",
      [randomUUID(), randomUUID(), ids.nominee],
    );
    const disabled = await service.disableSchoolAdminAuthority({
      principal: principal(ids.provider),
      tenantId: ids.tenant,
      authorityId: nomination.authorityId,
      expectedVersion: 2,
      reason: "Nonaktifkan penanggung jawab",
      idempotencyKey: `disable-${randomUUID()}`,
      correlationId: disableCorrelation,
    });
    assert.equal(disabled.status, "disabled");
    assert.equal(disabled.remainingActive, 2);
    authority = await authorityRow(connection, nomination.authorityId);
    assert.equal(authority!.authority_state, "disabled");
    assert.equal(authority!.version, 3);
    assert.notEqual(authority!.disabled_at, null);
    assert.equal(await countSessions(connection, ids.nominee), 0);
    assert.equal(await tenantRole(connection, ids.nominee), null);

    // Recovery targets the disabled authority; proof completion alone never reactivates.
    const recovery = await service.startSchoolAdminRecovery({
      principal: principal(ids.provider),
      tenantId: ids.tenant,
      authorityId: nomination.authorityId,
      expectedAuthorityVersion: 3,
      reason: "Pemulihan akses penanggung jawab",
      idempotencyKey: `recover-${randomUUID()}`,
      correlationId: recoveryCorrelation,
    });
    assert.equal(recovery.status, "recovery-started");
    const recoveryProof = await proofRow(connection, recovery.proofId);
    assert.equal(recoveryProof!.kind, "recovery");
    assert.equal(recoveryProof!.proof_state, "pending");
    assert.equal(recoveryProof!.version, 1);
    const recoveryCompleted = await service.completeRecoveryProof({
      principal: principal(ids.provider),
      tenantId: ids.tenant,
      caseId: recovery.caseId,
      expectedProofVersion: 1,
      secret: recovery.secret,
      idempotencyKey: `recovery-proof-${randomUUID()}`,
      correlationId: recoveryProofCorrelation,
    });
    assert.equal(recoveryCompleted.status, "proof-completed");
    assert.equal(recoveryCompleted.authorityState, "disabled");
    authority = await authorityRow(connection, nomination.authorityId);
    assert.equal(authority!.authority_state, "disabled");

    // A separate Provider command reactivates after the completed recovery proof.
    const reactivated = await service.reactivateSchoolAdminAuthority({
      principal: principal(ids.provider),
      tenantId: ids.tenant,
      caseId: recovery.caseId,
      authorityId: nomination.authorityId,
      expectedAuthorityVersion: 3,
      expectedProofVersion: 2,
      reason: "Reaktivasi penanggung jawab",
      idempotencyKey: `reactivate-${randomUUID()}`,
      correlationId: reactivateCorrelation,
    });
    assert.equal(reactivated.status, "reactivated");
    assert.equal(reactivated.activeCount, 3);
    authority = await authorityRow(connection, nomination.authorityId);
    assert.equal(authority!.authority_state, "active");
    assert.equal(authority!.version, 4);
    assert.equal(await countActiveAuthorities(connection, ids.tenant), 3);

    // Audit: canonical event names, one event per transition, chained hashes, actor provenance.
    const events = await tenantEvents(connection, ids.tenant);
    assert.deepEqual(
      events.map((event) => event.event_type),
      [
        "school_admin.nomination_created",
        "school_admin.account_control_proof_completed",
        "school_admin.authority_granted",
        "school_admin.authority_disabled",
        "school_admin.recovery_started",
        "school_admin.recovery_proof_completed",
        "school_admin.authority_reactivated",
      ],
    );
    for (let index = 1; index < events.length; index += 1) {
      assert.equal(events[index].previous_hash, events[index - 1].event_hash);
    }
    for (let index = 0; index < events.length; index += 1) {
      assert.equal(events[index].correlation_id, correlations[index]);
    }
    assert.equal(events[0].actor_kind, "provider-admin");
    assert.equal(events[0].actor_provider_user_id, ids.provider);
    assert.equal(events[1].actor_kind, "tenant-user");
    assert.equal(events[1].actor_tenant_user_id, ids.nominee);
    for (const event of events) {
      if (event.actor_kind === "provider-admin") {
        assert.equal(event.actor_provider_user_id, ids.provider);
      } else {
        assert.equal(event.actor_tenant_user_id, ids.nominee);
      }
    }
    assert.equal((events[0].metadata as { evidence: { caseId: string } }).evidence.caseId, caseId);
    assert.equal((events[1].metadata as { evidence: { caseId: string } }).evidence.caseId, caseId);
    assert.equal((events[2].metadata as { evidence: { caseId: string } }).evidence.caseId, caseId);
    assert.equal((events[3].metadata as { evidence: { caseId: string | null } }).evidence.caseId, null);
    assert.equal((events[3].metadata as { details: { revocationCount: number } }).details.revocationCount, 1);
    for (const event of events.slice(4)) {
      assert.equal((event.metadata as { evidence: { caseId: string } }).evidence.caseId, recovery.caseId);
    }
  });
});

mysqlTest("MySQL replacement cutover atomically swaps the selected incumbent and revokes sessions", async () => {
  await withSetup(async (connection, ids) => {
    const caseId = randomUUID();
    const nomination = await service.nominateSchoolAdmin({
      principal: principal(ids.provider),
      tenantId: ids.tenant,
      email: `${ids.nominee}@test.invalid`,
      reason: "Serah terima penanggung jawab",
      caseId,
      incumbentAuthorityId: ids.incumbentAuthority,
      idempotencyKey: `nom-${randomUUID()}`,
      correlationId: randomUUID(),
    });
    assert.equal(nomination.replacement, true);
    await service.completeAccountControlProof({
      principal: principal(ids.provider),
      tenantId: ids.tenant,
      caseId,
      expectedProofVersion: 1,
      secret: nomination.secret,
      idempotencyKey: `proof-${randomUUID()}`,
      correlationId: randomUUID(),
    });

    const cutoverCorrelation = randomUUID();
    const cutover = await service.completeSchoolAdminReplacement({
      principal: principal(ids.provider),
      tenantId: ids.tenant,
      caseId,
      successorAuthorityId: nomination.authorityId,
      successorExpectedVersion: 1,
      incumbentAuthorityId: ids.incumbentAuthority,
      incumbentExpectedVersion: 1,
      expectedProofVersion: 2,
      reason: "Serah terima selesai",
      idempotencyKey: `cutover-${randomUUID()}`,
      correlationId: cutoverCorrelation,
    });
    assert.equal(cutover.status, "cutover-completed");
    assert.equal(cutover.activeCount, 2);

    const successor = await authorityRow(connection, nomination.authorityId);
    assert.equal(successor!.authority_state, "active");
    assert.equal(successor!.version, 2);
    const incumbent = await authorityRow(connection, ids.incumbentAuthority);
    assert.equal(incumbent!.authority_state, "disabled");
    assert.equal(incumbent!.version, 2);
    const other = await authorityRow(connection, ids.otherAuthority);
    assert.equal(other!.authority_state, "active");
    assert.equal(await tenantRole(connection, ids.nominee), "school-admin");
    assert.equal(await tenantRole(connection, ids.incumbent), null);
    assert.equal(await countSessions(connection, ids.incumbent), 0);
    assert.equal(await countSessions(connection, ids.otherAdmin), 1);
    const proof = await proofRow(connection, nomination.proofId);
    assert.equal(proof!.proof_state, "completed");
    assert.equal(proof!.version, 3);

    // Exactly three canonical events are linked under one case ID and one correlation.
    const events = await tenantEvents(connection, ids.tenant);
    assert.equal(events.length, 5);
    const cutoverTypes = [
      "school_admin.authority_granted",
      "school_admin.authority_disabled",
      "school_admin.replacement_cutover_completed",
    ];
    const cutoverEvents = events.filter((event) => cutoverTypes.includes(event.event_type));
    assert.equal(cutoverEvents.length, 3);
    assert.deepEqual(cutoverEvents.map((event) => event.event_type).sort(), [...cutoverTypes].sort());
    for (const event of cutoverEvents) {
      assert.equal(event.correlation_id, cutoverCorrelation);
      assert.equal((event.metadata as { evidence: { caseId: string } }).evidence.caseId, caseId);
    }
    const parent = cutoverEvents.find(
      (event) => event.event_type === "school_admin.replacement_cutover_completed",
    );
    assert.ok(parent);
    assert.equal(parent.target_school_admin_authority_id, null);
    assert.equal(parent.target_school_admin_proof_id, nomination.proofId);
    const parentEnvelope = parent.metadata as {
      evidence: { after: { successorAuthorityState: string; incumbentAuthorityState: string; activeCount: number } };
      details: {
        successorAuthorityId: string;
        successorUserId: string;
        incumbentAuthorityId: string;
        incumbentUserId: string;
        revocationCount: number;
      };
    };
    const parentDetails = parentEnvelope.details;
    assert.equal(parentDetails.successorAuthorityId, nomination.authorityId);
    assert.equal(parentDetails.successorUserId, ids.nominee);
    assert.equal(parentDetails.incumbentAuthorityId, ids.incumbentAuthority);
    assert.equal(parentDetails.incumbentUserId, ids.incumbent);
    assert.equal(parentEnvelope.evidence.after.successorAuthorityState, "active");
    assert.equal(parentEnvelope.evidence.after.incumbentAuthorityState, "disabled");
    assert.equal(parentDetails.revocationCount, 1);
    assert.equal(parentEnvelope.evidence.after.activeCount, 2);
  });
});

mysqlTest("MySQL blocks disabling the final active School Admin and never enumerates foreign identities", async () => {
  await withSetup(async (connection, ids) => {
    const first = await service.disableSchoolAdminAuthority({
      principal: principal(ids.provider),
      tenantId: ids.tenant,
      authorityId: ids.otherAuthority,
      expectedVersion: 1,
      reason: "Nonaktifkan admin kedua",
      idempotencyKey: `disable-${randomUUID()}`,
      correlationId: randomUUID(),
    });
    assert.equal(first.status, "disabled");
    assert.equal(first.remainingActive, 1);

    await assert.rejects(
      service.disableSchoolAdminAuthority({
        principal: principal(ids.provider),
        tenantId: ids.tenant,
        authorityId: ids.incumbentAuthority,
        expectedVersion: 1,
        reason: "Tidak boleh mengosongkan cakupan",
        idempotencyKey: `disable-${randomUUID()}`,
        correlationId: randomUUID(),
      }),
      (error: unknown) => error instanceof SecurityCommandError && error.code === "integrity-failure",
    );
    assert.equal(await countActiveAuthorities(connection, ids.tenant), 1);

    // A Tenant user cannot invoke Provider-owned mutations.
    await expectContextDenied(service.disableSchoolAdminAuthority({
      principal: principal(ids.nominee),
      tenantId: ids.tenant,
      authorityId: ids.incumbentAuthority,
      expectedVersion: 1,
      reason: "Coba oleh tenant",
      idempotencyKey: `disable-${randomUUID()}`,
      correlationId: randomUUID(),
    }));

    // Foreign Tenant, Provider Admin, Applicant, roster, and nonexistent emails all deny identically.
    const emails = [
      `${ids.foreignUser}@test.invalid`,
      `${ids.provider}@test.invalid`,
      `${ids.applicant}@test.invalid`,
      `${ids.incumbent}@test.invalid`,
      `nonexistent-${randomUUID()}@random.test`,
    ];
    for (const [index, email] of emails.entries()) {
      await assert.rejects(
        service.nominateSchoolAdmin({
          principal: principal(ids.provider),
          tenantId: ids.tenant,
          email,
          reason: "Uji enumerasi",
          caseId: randomUUID(),
          idempotencyKey: `nom-${randomUUID()}`,
          correlationId: randomUUID(),
        }),
        (error: unknown) => error instanceof SecurityCommandError && error.code === "context-denied",
      );
      assert.equal(index >= 0, true);
    }
  });
});

mysqlTest("MySQL enforces idempotent replay and tenant-qualified integrity constraints", async () => {
  await withSetup(async (connection, ids) => {
    // Sequential replay of the same command returns the identical result with no duplicates.
    const input = {
      principal: principal(ids.provider),
      tenantId: ids.tenant,
      email: `${ids.nominee}@test.invalid`,
      reason: "Penunjukan penanggung jawab",
      caseId: randomUUID(),
      idempotencyKey: `nom-replay-${randomUUID()}`,
      correlationId: randomUUID(),
    };
    const first = await service.nominateSchoolAdmin(input);
    const replay = await service.nominateSchoolAdmin({ ...input, correlationId: randomUUID() });
    assert.deepEqual(replay, first);
    let [authorities] = await connection.execute<mysql.RowDataPacket[]>(
      "SELECT COUNT(*) AS `count` FROM `school_admin_authority` WHERE `tenant_id`=? AND `user_id`=?",
      [ids.tenant, ids.nominee],
    );
    assert.equal(Number(authorities[0].count), 1);
    let [proofs] = await connection.execute<mysql.RowDataPacket[]>(
      "SELECT COUNT(*) AS `count` FROM `school_admin_proof` WHERE `tenant_id`=? AND `case_id`=?",
      [ids.tenant, input.caseId],
    );
    assert.equal(Number(proofs[0].count), 1);
    let events = await tenantEvents(connection, ids.tenant);
    assert.equal(events.length, 1);
    assert.equal(events[0].event_type, "school_admin.nomination_created");

    // Proofs cannot reference an authority from another Tenant (FK), and an active
    // authority requires a grant timestamp (CHECK).
    await expectIntegrityFailure(connection.execute(
      "INSERT INTO `school_admin_proof` (`id`,`tenant_id`,`authority_id`,`case_id`,`kind`,`proof_state`,`secret_digest`,`expires_at`,`version`,`idempotency_key`,`created_at`,`updated_at`) VALUES (?,?,?,?, 'nomination','pending',REPEAT('c',64),DATE_ADD(NOW(3),INTERVAL 1 DAY),1,?,NOW(3),NOW(3))",
      [randomUUID(), ids.tenant, ids.foreignAuthority, randomUUID(), randomUUID()],
    ));
    await expectIntegrityFailure(connection.execute(
      "INSERT INTO `school_admin_authority` (`id`,`tenant_id`,`user_id`,`authority_state`,`version`,`granted_at`,`created_at`,`updated_at`) VALUES (?,?,?,'active',1,NULL,NOW(3),NOW(3))",
      [randomUUID(), ids.tenant, ids.spare],
    ));

    // Reusing a caseId across nominations violates the tenant-qualified unique constraint.
    const duplicateCaseId = randomUUID();
    await service.nominateSchoolAdmin({
      principal: principal(ids.provider),
      tenantId: ids.tenant,
      email: `${ids.spare}@test.invalid`,
      reason: "Penunjukan penanggung jawab",
      caseId: duplicateCaseId,
      idempotencyKey: `nom-${randomUUID()}`,
      correlationId: randomUUID(),
    });
    await expectIntegrityFailure(service.nominateSchoolAdmin({
      principal: principal(ids.provider),
      tenantId: ids.tenant,
      email: `${ids.secondNominee}@test.invalid`,
      reason: "Penunjukan kedua pada kasus yang sama",
      caseId: duplicateCaseId,
      idempotencyKey: `nom-${randomUUID()}`,
      correlationId: randomUUID(),
    }));

    // Concurrent double-submission of the same command: one executes, the other replays.
    const concurrent = {
      principal: principal(ids.provider),
      tenantId: ids.tenant,
      email: `${ids.secondNominee}@test.invalid`,
      reason: "Penunjukan penanggung jawab",
      caseId: randomUUID(),
      idempotencyKey: `nom-race-${randomUUID()}`,
      correlationId: randomUUID(),
    };
    const outcomes = await Promise.allSettled([
      service.nominateSchoolAdmin(concurrent),
      service.nominateSchoolAdmin(concurrent),
    ]);
    const fulfilled = outcomes.filter(
      (result): result is PromiseFulfilledResult<typeof first> => result.status === "fulfilled",
    );
    assert.equal(fulfilled.length, 2);
    assert.deepEqual(fulfilled[0].value, fulfilled[1].value);
    [authorities] = await connection.execute<mysql.RowDataPacket[]>(
      "SELECT COUNT(*) AS `count` FROM `school_admin_authority` WHERE `tenant_id`=? AND `user_id`=?",
      [ids.tenant, ids.secondNominee],
    );
    assert.equal(Number(authorities[0].count), 1);
    [proofs] = await connection.execute<mysql.RowDataPacket[]>(
      "SELECT COUNT(*) AS `count` FROM `school_admin_proof` WHERE `tenant_id`=? AND `case_id`=?",
      [ids.tenant, concurrent.caseId],
    );
    assert.equal(Number(proofs[0].count), 1);
    events = await tenantEvents(connection, ids.tenant);
    assert.equal(events.length, 3);
  });
});

mysqlTest("MySQL serializes concurrent disables on the Tenant roster lock and preserves coverage", async () => {
  await withSetup(async (connection, ids) => {
    const outcomes = await Promise.allSettled([
      service.disableSchoolAdminAuthority({
        principal: principal(ids.provider),
        tenantId: ids.tenant,
        authorityId: ids.incumbentAuthority,
        expectedVersion: 1,
        reason: "Nonaktifkan admin pertama",
        idempotencyKey: `disable-a-${randomUUID()}`,
        correlationId: randomUUID(),
      }),
      service.disableSchoolAdminAuthority({
        principal: principal(ids.provider),
        tenantId: ids.tenant,
        authorityId: ids.otherAuthority,
        expectedVersion: 1,
        reason: "Nonaktifkan admin kedua",
        idempotencyKey: `disable-b-${randomUUID()}`,
        correlationId: randomUUID(),
      }),
    ]);
    const fulfilled = outcomes.filter(
      (result): result is PromiseFulfilledResult<SchoolAdminDisableResult> => result.status === "fulfilled",
    );
    const rejected = outcomes.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    assert.equal(fulfilled.length, 1);
    assert.equal(fulfilled[0].value.status, "disabled");
    assert.equal(fulfilled[0].value.remainingActive, 1);
    assert.equal(rejected.length, 1);
    assert.ok(rejected[0].reason instanceof SecurityCommandError);
    assert.ok(["integrity-failure", "stale-version"].includes(rejected[0].reason.code));
    assert.equal(await countActiveAuthorities(connection, ids.tenant), 1);
  });
});

mysqlTest("MySQL serializes a concurrent grant and disable without losing coverage", async () => {
  await withSetup(async (connection, ids) => {
    const caseId = randomUUID();
    const nomination = await service.nominateSchoolAdmin({
      principal: principal(ids.provider),
      tenantId: ids.tenant,
      email: `${ids.nominee}@test.invalid`,
      reason: "Penunjukan penanggung jawab",
      caseId,
      idempotencyKey: `nom-${randomUUID()}`,
      correlationId: randomUUID(),
    });
    await service.completeAccountControlProof({
      principal: principal(ids.provider),
      tenantId: ids.tenant,
      caseId,
      expectedProofVersion: 1,
      secret: nomination.secret,
      idempotencyKey: `proof-${randomUUID()}`,
      correlationId: randomUUID(),
    });

    const outcomes = await Promise.allSettled([
      service.grantSchoolAdminAuthority({
        principal: principal(ids.provider),
        tenantId: ids.tenant,
        caseId,
        authorityId: nomination.authorityId,
        expectedAuthorityVersion: 1,
        expectedProofVersion: 2,
        reason: "Konfirmasi penunjukan",
        idempotencyKey: `grant-${randomUUID()}`,
        correlationId: randomUUID(),
      }),
      service.disableSchoolAdminAuthority({
        principal: principal(ids.provider),
        tenantId: ids.tenant,
        authorityId: ids.incumbentAuthority,
        expectedVersion: 1,
        reason: "Nonaktifkan penanggung jawab lama",
        idempotencyKey: `disable-${randomUUID()}`,
        correlationId: randomUUID(),
      }),
    ]);
    const fulfilled = outcomes.filter((result) => result.status === "fulfilled");
    const rejected = outcomes.filter((result) => result.status === "rejected");
    assert.equal(fulfilled.length, 2);
    assert.equal(rejected.length, 0);

    const successor = await authorityRow(connection, nomination.authorityId);
    assert.equal(successor!.authority_state, "active");
    const incumbent = await authorityRow(connection, ids.incumbentAuthority);
    assert.equal(incumbent!.authority_state, "disabled");
    assert.equal(await tenantRole(connection, ids.nominee), "school-admin");
    assert.equal(await tenantRole(connection, ids.incumbent), null);
    assert.equal(await countSessions(connection, ids.incumbent), 0);
    assert.equal(await countActiveAuthorities(connection, ids.tenant), 2);
  });
});
