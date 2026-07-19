import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after } from "node:test";

import { hashPassword, verifyPassword } from "better-auth/crypto";
import mysql from "mysql2/promise";

import { closeDatabasePool } from "@/db";
import { createApplicantApplicationSubmission } from "@/lib/applicant-application-submission";
import { applicantApplicationSubmissionStore } from "@/lib/applicant-application-submission-data";
import {
  applicationApprovalStore,
  createApplicationApprovalStore,
  type ApprovalTransactionStep,
} from "@/lib/provider-application-data";
import { resolveCentralDestination } from "@/lib/central-identity";
import { getCentralIdentity } from "@/lib/central-identity-data";
import { createApproveSimasApplicationCommand } from "@/lib/provider-applications";

const databaseUrl = process.env.DATABASE_URL;
after(() => closeDatabasePool());
const mysqlTest = databaseUrl ? test : test.skip;
const approvalSteps: readonly ApprovalTransactionStep[] = [
  "tenant-created",
  "user-promoted",
  "applicant-removed",
  "sessions-revoked",
  "application-finalized",
  "outbox-written",
];
const decidedAt = new Date("2026-07-19T04:30:00.000Z");

type ApprovalFixture = Readonly<{
  connection: mysql.Connection;
  ownerUserId: string;
  providerUserId: string;
  accountId: string;
  sessionIds: readonly string[];
  credentialHash: string;
  email: string;
  password: string;
  canonicalNpsn: string;
  applicationId: string;
  bindingId: string;
  conflictApplicationIds: readonly string[];
}>;

type PersistedApprovalState = Readonly<{
  owner: { tenantId: string | null; role: string | null };
  accounts: readonly { id: string; userId: string; password: string | null }[];
  applicants: readonly string[];
  sessions: readonly string[];
  bindings: readonly { id: string; userId: string; canonicalNpsn: string }[];
  activations: readonly string[];
  application: {
    status: string;
    decidedAt: Date | null;
    decidedByProviderAdminId: string | null;
    approvedTenantId: string | null;
    rejectionReason: string | null;
  };
  tenants: readonly { id: string; npsn: string; domain: string; sourceApplicationId: string }[];
  outbox: readonly { eventType: string; aggregateId: string }[];
}>;

function randomNpsn(): string {
  return String(Math.floor(10_000_000 + Math.random() * 90_000_000));
}

async function createFixture(options: Readonly<{
  usedDomain?: string;
  existingNpsnConflict?: boolean;
}> = {}): Promise<ApprovalFixture> {
  const connection = await mysql.createConnection(databaseUrl!);
  const ownerUserId = randomUUID();
  const providerUserId = randomUUID();
  const accountId = randomUUID();
  const sessionIds = [randomUUID(), randomUUID()];
  const email = `${ownerUserId}@example.test`;
  const password = "Existing-password-14!";
  const credentialHash = await hashPassword(password);
  const canonicalNpsn = randomNpsn();
  const conflictApplicationIds: string[] = [];

  await connection.execute(
    "INSERT INTO `user` (`id`, `name`, `email`, `email_verified`, `created_at`, `updated_at`) VALUES (?, 'Applicant Owner', ?, false, NOW(3), NOW(3)), (?, 'Provider', ?, false, NOW(3), NOW(3))",
    [ownerUserId, email, providerUserId, `${providerUserId}@example.test`],
  );
  await connection.execute("INSERT INTO `applicant` (`user_id`, `created_at`) VALUES (?, NOW(3))", [ownerUserId]);
  await connection.execute("INSERT INTO `provider_admin` (`user_id`, `created_at`) VALUES (?, NOW(3))", [providerUserId]);
  await connection.execute(
    "INSERT INTO `account` (`id`, `account_id`, `provider_id`, `user_id`, `password`, `created_at`, `updated_at`) VALUES (?, ?, 'credential', ?, ?, NOW(3), NOW(3))",
    [accountId, ownerUserId, ownerUserId, credentialHash],
  );
  for (const sessionId of sessionIds) {
    await connection.execute(
      "INSERT INTO `session` (`id`, `expires_at`, `token`, `created_at`, `updated_at`, `user_id`) VALUES (?, DATE_ADD(NOW(3), INTERVAL 1 DAY), ?, NOW(3), NOW(3), ?)",
      [sessionId, randomUUID(), ownerUserId],
    );
  }

  const submit = createApplicantApplicationSubmission({ store: applicantApplicationSubmissionStore });
  const submitted = await submit(ownerUserId, randomUUID(), {
    schoolName: "SMA Approval Integration",
    npsn: canonicalNpsn,
    educationLevel: "SMA",
    address: "Jalan Integration 14",
    contactName: "Snapshot Contact",
    contactPosition: "Operator",
    contactEmail: "different-contact@example.test",
    contactWhatsapp: "081234567890",
  });
  assert.equal(submitted.ok, true);
  if (!submitted.ok) throw new Error("Fixture application submission failed");

  const [applications] = await connection.execute<mysql.RowDataPacket[]>(
    "SELECT `binding_id` FROM `simas_application` WHERE `id` = ?",
    [submitted.applicationId],
  );
  const bindingId = applications[0].binding_id as string;

  if (options.usedDomain || options.existingNpsnConflict) {
    const conflictApplicationId = randomUUID();
    conflictApplicationIds.push(conflictApplicationId);
    await connection.execute(
      "INSERT INTO `simas_application` (`id`, `school_name`, `npsn`, `education_level`, `address`, `contact_name`, `contact_position`, `contact_email`, `contact_whatsapp`, `status`, `submitted_at`) VALUES (?, 'Existing Tenant Source', ?, 'SMA', 'Existing address', 'Existing contact', 'Operator', ?, '081111111111', 'pending', NOW(3))",
      [conflictApplicationId, randomNpsn(), `${conflictApplicationId}@example.test`],
    );
    await connection.execute(
      "INSERT INTO `tenant` (`id`, `name`, `domain`, `npsn`, `source_application_id`, `approved_at`, `created_at`, `updated_at`) VALUES (?, 'Existing Tenant', ?, ?, ?, NOW(3), NOW(3), NOW(3))",
      [
        randomUUID(),
        options.usedDomain ?? `existing-${randomUUID()}`,
        options.existingNpsnConflict ? canonicalNpsn : randomNpsn(),
        conflictApplicationId,
      ],
    );
  }

  return {
    connection,
    ownerUserId,
    providerUserId,
    accountId,
    sessionIds,
    credentialHash,
    email,
    password,
    canonicalNpsn,
    applicationId: submitted.applicationId,
    bindingId,
    conflictApplicationIds,
  };
}

function createApprove(fixture: ApprovalFixture, store = applicationApprovalStore) {
  return createApproveSimasApplicationCommand({
    authorize: async () => ({ userId: fixture.providerUserId }),
    store,
    now: () => decidedAt,
  });
}

async function readState(fixture: ApprovalFixture): Promise<PersistedApprovalState> {
  const { connection, ownerUserId, applicationId } = fixture;
  const [owners] = await connection.execute<mysql.RowDataPacket[]>(
    "SELECT `tenant_id`, `tenant_role` FROM `user` WHERE `id` = ?",
    [ownerUserId],
  );
  const [accounts] = await connection.execute<mysql.RowDataPacket[]>(
    "SELECT `id`, `user_id`, `password` FROM `account` WHERE `user_id` = ? ORDER BY `id`",
    [ownerUserId],
  );
  const [applicants] = await connection.execute<mysql.RowDataPacket[]>(
    "SELECT `user_id` FROM `applicant` WHERE `user_id` = ? ORDER BY `user_id`",
    [ownerUserId],
  );
  const [sessions] = await connection.execute<mysql.RowDataPacket[]>(
    "SELECT `id` FROM `session` WHERE `user_id` = ? ORDER BY `id`",
    [ownerUserId],
  );
  const [bindings] = await connection.execute<mysql.RowDataPacket[]>(
    "SELECT `id`, `user_id`, `canonical_npsn` FROM `applicant_school_binding` WHERE `user_id` = ? ORDER BY `id`",
    [ownerUserId],
  );
  const [activations] = await connection.execute<mysql.RowDataPacket[]>(
    "SELECT `user_id` FROM `temporary_credential_activation` WHERE `user_id` = ? ORDER BY `user_id`",
    [ownerUserId],
  );
  const [applications] = await connection.execute<mysql.RowDataPacket[]>(
    "SELECT `status`, `decided_at`, `decided_by_provider_admin_id`, `approved_tenant_id`, `rejection_reason` FROM `simas_application` WHERE `id` = ?",
    [applicationId],
  );
  const [tenants] = await connection.execute<mysql.RowDataPacket[]>(
    "SELECT `id`, `npsn`, `domain`, `source_application_id` FROM `tenant` WHERE `source_application_id` = ? ORDER BY `id`",
    [applicationId],
  );
  const [outbox] = await connection.execute<mysql.RowDataPacket[]>(
    "SELECT `event_type`, `aggregate_id` FROM `transactional_outbox` WHERE `aggregate_id` = ? ORDER BY `id`",
    [applicationId],
  );
  const application = applications[0];

  return {
    owner: { tenantId: owners[0].tenant_id, role: owners[0].tenant_role },
    accounts: accounts.map((row) => ({ id: row.id, userId: row.user_id, password: row.password })),
    applicants: applicants.map((row) => row.user_id),
    sessions: sessions.map((row) => row.id),
    bindings: bindings.map((row) => ({ id: row.id, userId: row.user_id, canonicalNpsn: row.canonical_npsn })),
    activations: activations.map((row) => row.user_id),
    application: {
      status: application.status,
      decidedAt: application.decided_at,
      decidedByProviderAdminId: application.decided_by_provider_admin_id,
      approvedTenantId: application.approved_tenant_id,
      rejectionReason: application.rejection_reason,
    },
    tenants: tenants.map((row) => ({ id: row.id, npsn: row.npsn, domain: row.domain, sourceApplicationId: row.source_application_id })),
    outbox: outbox.map((row) => ({ eventType: row.event_type, aggregateId: row.aggregate_id })),
  };
}

function assertApprovedIdentityState(state: PersistedApprovalState, fixture: ApprovalFixture): void {
  assert.equal(state.tenants.length, 1);
  const approvedTenant = state.tenants[0];
  assert.deepEqual(state.owner, { tenantId: approvedTenant.id, role: "school-admin" });
  assert.deepEqual(state.accounts, [
    { id: fixture.accountId, userId: fixture.ownerUserId, password: fixture.credentialHash },
  ]);
  assert.deepEqual(state.applicants, []);
  assert.deepEqual(state.sessions, []);
  assert.deepEqual(state.bindings, [
    { id: fixture.bindingId, userId: fixture.ownerUserId, canonicalNpsn: fixture.canonicalNpsn },
  ]);
  assert.deepEqual(state.activations, []);
  assert.equal(state.application.status, "approved");
  assert.equal(state.application.decidedByProviderAdminId, fixture.providerUserId);
  assert.equal(state.application.approvedTenantId, approvedTenant.id);
  assert.equal(state.application.rejectionReason, null);
  assert.ok(state.application.decidedAt instanceof Date);
  assert.deepEqual(state.outbox, [
    { eventType: "simas.application.approved", aggregateId: fixture.applicationId },
  ]);
}

function assertPendingIdentityState(state: PersistedApprovalState, fixture: ApprovalFixture): void {
  assert.deepEqual(state, {
    owner: { tenantId: null, role: null },
    accounts: [{ id: fixture.accountId, userId: fixture.ownerUserId, password: fixture.credentialHash }],
    applicants: [fixture.ownerUserId],
    sessions: [...fixture.sessionIds].sort(),
    bindings: [{ id: fixture.bindingId, userId: fixture.ownerUserId, canonicalNpsn: fixture.canonicalNpsn }],
    activations: [],
    application: {
      status: "pending",
      decidedAt: null,
      decidedByProviderAdminId: null,
      approvedTenantId: null,
      rejectionReason: null,
    },
    tenants: [],
    outbox: [],
  });
}

async function cleanupFixture(fixture: ApprovalFixture): Promise<void> {
  const { connection, ownerUserId, providerUserId, applicationId, conflictApplicationIds } = fixture;
  try {
    await connection.execute("SET FOREIGN_KEY_CHECKS = 0");
    await connection.execute("DELETE FROM `transactional_outbox` WHERE `aggregate_id` = ?", [applicationId]);
    await connection.execute("DELETE FROM `tenant` WHERE `source_application_id` = ?", [applicationId]);
    for (const conflictApplicationId of conflictApplicationIds) {
      await connection.execute("DELETE FROM `tenant` WHERE `source_application_id` = ?", [conflictApplicationId]);
      await connection.execute("DELETE FROM `simas_application` WHERE `id` = ?", [conflictApplicationId]);
    }
    await connection.execute("DELETE FROM `simas_application` WHERE `id` = ?", [applicationId]);
    await connection.execute("DELETE FROM `temporary_credential_activation` WHERE `user_id` = ?", [ownerUserId]);
    await connection.execute("DELETE FROM `applicant_school_binding` WHERE `user_id` = ?", [ownerUserId]);
    await connection.execute("DELETE FROM `session` WHERE `user_id` = ?", [ownerUserId]);
    await connection.execute("DELETE FROM `account` WHERE `user_id` = ?", [ownerUserId]);
    await connection.execute("DELETE FROM `applicant` WHERE `user_id` = ?", [ownerUserId]);
    await connection.execute("DELETE FROM `provider_admin` WHERE `user_id` = ?", [providerUserId]);
    await connection.execute("DELETE FROM `user` WHERE `id` IN (?, ?)", [ownerUserId, providerUserId]);
    await connection.execute("SET FOREIGN_KEY_CHECKS = 1");
  } finally {
    await connection.end();
  }
}

mysqlTest("MySQL atomically promotes the existing applicant and makes identical approval retries idempotent", async () => {
  const fixture = await createFixture();
  try {
    const approve = createApprove(fixture);
    const approved = await approve({ applicationId: fixture.applicationId, subdomain: " approval-integration " });
    assert.equal(approved.ok, true);
    if (!approved.ok) return;
    const tenantId = approved.tenantId;
    assert.equal(approved.status, "approved");
    assert.deepEqual(await approve({ applicationId: fixture.applicationId, subdomain: "approval-integration" }), {
      ok: true,
      status: "already-approved",
      tenantId,
    });
    assert.deepEqual(await approve({ applicationId: fixture.applicationId, subdomain: "different-domain" }), {
      ok: false,
      code: "decision-conflict",
      status: "approved",
    });

    const state = await readState(fixture);
    assert.deepEqual(state.owner, { tenantId, role: "school-admin" });
    assert.deepEqual(state.accounts, [
      { id: fixture.accountId, userId: fixture.ownerUserId, password: fixture.credentialHash },
    ]);
    assert.deepEqual(state.tenants, [
      { id: tenantId, npsn: fixture.canonicalNpsn, domain: "approval-integration", sourceApplicationId: fixture.applicationId },
    ]);
    assert.deepEqual(state.applicants, []);
    assert.deepEqual(state.sessions, []);
    assert.deepEqual(state.bindings, [
      { id: fixture.bindingId, userId: fixture.ownerUserId, canonicalNpsn: fixture.canonicalNpsn },
    ]);
    assert.deepEqual(state.activations, []);
    assert.deepEqual(state.outbox, [
      { eventType: "simas.application.approved", aggregateId: fixture.applicationId },
    ]);

    const reauthenticatedIdentity = await getCentralIdentity(fixture.ownerUserId);
    assert.deepEqual(reauthenticatedIdentity, {
      kind: "tenant-member",
      tenantId,
      domain: "approval-integration",
      passwordChangeRequired: false,
      promotedApplicant: true,
    });
    assert.equal(resolveCentralDestination(reauthenticatedIdentity), "/apply");

    assert.equal(await verifyPassword({
      hash: state.accounts[0].password!,
      password: fixture.password,
    }), true);
    assert.notEqual(resolveCentralDestination(reauthenticatedIdentity), "/change-password");
  } finally {
    await cleanupFixture(fixture);
  }
});

for (const step of approvalSteps) {
  mysqlTest(`MySQL rolls back every approval write when ${step} fails`, async () => {
    const fixture = await createFixture();
    try {
      const injectedFailure = new Error(`Injected failure after ${step}`);
      const approve = createApprove(fixture, createApplicationApprovalStore({
        afterStep(completedStep) {
          if (completedStep === step) throw injectedFailure;
        },
      }));

      await assert.rejects(
        approve({ applicationId: fixture.applicationId, subdomain: `rollback-${step}` }),
        injectedFailure,
      );
      assertPendingIdentityState(await readState(fixture), fixture);
    } finally {
      await cleanupFixture(fixture);
    }
  });
}

mysqlTest("MySQL used-domain conflict preserves pending application and identity state", async () => {
  const usedDomain = `used-${randomUUID()}`;
  const fixture = await createFixture({ usedDomain });
  try {
    assert.deepEqual(await createApprove(fixture)({ applicationId: fixture.applicationId, subdomain: usedDomain }), {
      ok: false,
      code: "resource-conflict",
      field: "subdomain",
    });
    assertPendingIdentityState(await readState(fixture), fixture);
  } finally {
    await cleanupFixture(fixture);
  }
});

mysqlTest("MySQL existing-NPSN conflict preserves pending application and identity state", async () => {
  const fixture = await createFixture({ existingNpsnConflict: true });
  try {
    assert.deepEqual(await createApprove(fixture)({ applicationId: fixture.applicationId, subdomain: `free-${randomUUID()}` }), {
      ok: false,
      code: "resource-conflict",
      field: "npsn",
    });
    assertPendingIdentityState(await readState(fixture), fixture);
  } finally {
    await cleanupFixture(fixture);
  }
});

mysqlTest("MySQL concurrent identical approvals create one tenant and one final result", async () => {
  const fixture = await createFixture();
  try {
    const approve = createApprove(fixture);
    const results = await Promise.all([
      approve({ applicationId: fixture.applicationId, subdomain: "concurrent-identical" }),
      approve({ applicationId: fixture.applicationId, subdomain: "concurrent-identical" }),
    ]);
    assert.deepEqual(results.map((result) => result.ok && result.status).sort(), ["already-approved", "approved"]);

    assertApprovedIdentityState(await readState(fixture), fixture);
  } finally {
    await cleanupFixture(fixture);
  }
});

mysqlTest("MySQL concurrent competing domains produce one approval and one decision conflict", async () => {
  const fixture = await createFixture();
  try {
    const approve = createApprove(fixture);
    const results = await Promise.all([
      approve({ applicationId: fixture.applicationId, subdomain: "competing-domain-a" }),
      approve({ applicationId: fixture.applicationId, subdomain: "competing-domain-b" }),
    ]);
    assert.equal(results.filter((result) => result.ok && result.status === "approved").length, 1);
    assert.equal(results.filter((result) => !result.ok && result.code === "decision-conflict").length, 1);

    assertApprovedIdentityState(await readState(fixture), fixture);
  } finally {
    await cleanupFixture(fixture);
  }
});
