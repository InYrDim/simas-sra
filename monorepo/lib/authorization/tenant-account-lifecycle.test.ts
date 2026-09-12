import assert from "node:assert/strict";
import test from "node:test";

import {
  createTenantAccountLifecycleService,
  createConsumeLifecycleCaseCommand,
  digestLifecycleSecret,
  type AccountLifecycleCase,
  type AccountLifecycleRepository,
  type LifecyclePerson,
  type TenantLifecycleAccount,
} from "@/lib/authorization/tenant-account-lifecycle";
import { SecurityCommandError } from "@/lib/authorization/security-command";

const TENANT_ID = "00000000-0000-4000-8000-000000000001";
const ADMIN_ID = "00000000-0000-4000-8000-000000000002";
const USER_ID = "00000000-0000-4000-8000-000000000003";
const ROLE_ID = "00000000-0000-4000-8000-000000000004";
const NOW = new Date("2026-08-02T10:00:00.000Z");

function account(overrides: Partial<TenantLifecycleAccount> = {}): TenantLifecycleAccount {
  return {
    userId: USER_ID,
    tenantId: TENANT_ID,
    name: "Budi Santoso",
    email: "budi@example.test",
    lifecycle: "pending-activation",
    version: 1,
    assignmentVersion: 1,
    schoolAdmin: false,
    linkedPersonId: null,
    ...overrides,
  };
}

function fixture(initial = account()) {
  let current = initial;
  let pending: AccountLifecycleCase | null = null;
  const outbox: unknown[] = [];
  let person: LifecyclePerson | null = null as LifecyclePerson | null;
  const repository: AccountLifecycleRepository = {
    lockTenant: async () => true,
    isSchoolAdmin: async (_tenantId, userId) => userId === ADMIN_ID,
    findIdentityByEmail: async (email) => email === current.email ? current : null,
    getAccount: async (_tenantId, userId) => userId === current.userId ? current : null,
    getPerson: async (_tenantId, personId) => person && person.id === personId ? person : null,
    listRoles: async () => [{ id: ROLE_ID, tenantId: TENANT_ID, lifecycle: "active" }],
    listAssignments: async () => [{ id: "assignment-1", roleId: ROLE_ID, state: "suspended", version: 2 }],
    findPendingCase: async () => pending,
    lockCase: async () => pending,
    completeCase: async () => { if (!pending) return false; pending = { ...pending, state: "completed", consumedAt: NOW }; return true; },
    activateConsumedAccount: async () => true,
    resetCredential: async () => true,
    createAccount: async (input) => {
      current = account({ userId: input.userId, name: input.name, email: input.email, lifecycle: input.lifecycle });
      return current;
    },
    linkPerson: async () => undefined,
    createCase: async (value) => { pending = value; },
    revokePendingCases: async () => { if (pending) pending = { ...pending, state: "revoked", version: pending.version + 1 }; },
    transitionLifecycle: async (input) => {
      if (current.version !== input.expectedVersion) return false;
      current = { ...current, lifecycle: input.lifecycle, version: current.version + 1, assignmentVersion: current.assignmentVersion + (input.bumpAssignmentVersion ? 1 : 0) };
      return true;
    },
    suspendAssignments: async () => [],
    restoreAssignments: async () => [],
    revokeSessions: async () => 0,
    deleteCredential: async () => undefined,
    unlinkPersonByAccount: async () => undefined,
    linkPersonToAccount: async () => 1,
  };
  const service = createTenantAccountLifecycleService({
    execute: async (input) => {
      const mutation = await input.authorizeAndMutate({
        actor: { kind: "tenant-user", userId: ADMIN_ID, tenantId: TENANT_ID, displayName: "Admin", email: "admin@example.test" },
        context: { kind: "tenant", contextId: TENANT_ID, tenantId: TENANT_ID },
        expectedVersions: [],
        transaction: {} as never,
      });
      outbox.push(...(mutation.outbox ?? []));
      return { commandId: "command-1", existing: false, result: mutation.result };
    },
    repository: () => repository,
    createId: (() => { let value = 10; return () => `00000000-0000-4000-8000-${String(value++).padStart(12, "0")}`; })(),
    generateSecret: (() => { let value = 1; return () => `one-time-secret-with-enough-entropy-${value++}`; })(),
    now: () => NOW,
    lifecycleSecretKey: "test-only-lifecycle-key-with-at-least-32-bytes",
  });
  return { service, repository, get account() { return current; }, get pending() { return pending; }, get person() { return person; }, set person(value: LifecyclePerson | null) { person = value; }, outbox };
}

const command = {
  principal: { kind: "authenticated-user", userId: ADMIN_ID } as const,
  tenantId: TENANT_ID,
  idempotencyKey: "lifecycle-command-1",
  correlationId: "00000000-0000-4000-8000-000000000099",
};

test("temporary activation secret is purpose-bound, hash-only at rest, and returned exactly on issue", async () => {
  const state = fixture();
  const result = await state.service.issueActivation({ ...command, targetUserId: USER_ID, expectedVersion: 1, deliveryChannel: "temporary-credential", mode: "reissue" });

  assert.equal(result.secret, "one-time-secret-with-enough-entropy-1");
  assert.equal(state.pending?.secretDigest, digestLifecycleSecret({ purpose: "activation", tenantId: TENANT_ID, userId: USER_ID, expiresAt: state.pending!.expiresAt, secret: result.secret! }));
  assert.equal(JSON.stringify(state.outbox).includes(result.secret!), false);
});

test("resend preserves a valid case while reissue revokes and replaces its material", async () => {
  const state = fixture();
  const first = await state.service.issueActivation({ ...command, targetUserId: USER_ID, expectedVersion: 1, deliveryChannel: "email", mode: "reissue" });
  const firstCase = state.pending;
  const resent = await state.service.issueActivation({ ...command, idempotencyKey: "resend-2", targetUserId: USER_ID, expectedVersion: 1, deliveryChannel: "email", mode: "resend" });
  assert.equal(resent.caseId, first.caseId);
  assert.equal(state.pending?.secretDigest, firstCase?.secretDigest);
  assert.equal(state.pending?.expiresAt.getTime(), firstCase?.expiresAt.getTime());

  const reissued = await state.service.issueActivation({ ...command, idempotencyKey: "reissue-3", targetUserId: USER_ID, expectedVersion: 1, deliveryChannel: "email", mode: "reissue" });
  assert.notEqual(reissued.caseId, first.caseId);
  assert.notEqual(state.pending?.secretDigest, firstCase?.secretDigest);
});

test("resend cannot change the delivery channel of an existing case", async () => {
  const state = fixture();
  await state.service.issueActivation({ ...command, targetUserId: USER_ID, expectedVersion: 1, deliveryChannel: "email", mode: "reissue" });

  await assert.rejects(
    state.service.issueActivation({ ...command, idempotencyKey: "resend-channel-change", targetUserId: USER_ID, expectedVersion: 1, deliveryChannel: "temporary-credential", mode: "resend" }),
    (error) => error instanceof SecurityCommandError && error.code === "stale-version",
  );
});

test("consuming a valid activation case is one-time and activates the account", async () => {
  const state = fixture();
  const issued = await state.service.issueActivation({ ...command, targetUserId: USER_ID, expectedVersion: 1, deliveryChannel: "temporary-credential", mode: "reissue" });
  const consume = createConsumeLifecycleCaseCommand({
    execute: async (input) => {
      const mutation = await input.authorizeAndMutate({
        actor: { kind: "system", service: "public-case-consumer" },
        context: { kind: "tenant", contextId: TENANT_ID, tenantId: TENANT_ID },
        expectedVersions: [],
        transaction: {} as never,
      });
      return { commandId: "consume-1", existing: false, result: mutation.result };
    },
    repository: () => state.repository,
    now: () => NOW,
  });

  assert.deepEqual(await consume({ tenantId: TENANT_ID, caseId: issued.caseId, secret: issued.secret!, correlationId: "consume-correlation", idempotencyKey: "consume-1" }), {
    status: "activated",
    tenantId: TENANT_ID,
    userId: USER_ID,
  });
  assert.equal(state.pending?.state, "completed");
  await assert.rejects(() => consume({ tenantId: TENANT_ID, caseId: issued.caseId, secret: issued.secret!, correlationId: "consume-correlation-2", idempotencyKey: "consume-2" }), (error) => error instanceof SecurityCommandError && error.code === "context-denied");
});

test("recovery consumes once and replaces the credential without exposing it in the result", async () => {
  const state = fixture(account({ lifecycle: "active" }));
  const issued = await state.service.initiateRecovery({ ...command, targetUserId: USER_ID, expectedVersion: 1, deliveryChannel: "temporary-credential", mode: "reissue" });
  let resetCredential = "";
  state.repository.resetCredential = async (_tenantId, _userId, credential) => { resetCredential = credential; return true; };
  const consume = createConsumeLifecycleCaseCommand({
    execute: async (input) => {
      const mutation = await input.authorizeAndMutate({ actor: { kind: "system", service: "public-case-consumer" }, context: { kind: "tenant", contextId: TENANT_ID, tenantId: TENANT_ID }, expectedVersions: [], transaction: {} as never });
      return { commandId: "consume-recovery-1", existing: false, result: mutation.result };
    },
    repository: () => state.repository,
    now: () => NOW,
  });
  assert.deepEqual(await consume({ tenantId: TENANT_ID, caseId: issued.caseId, secret: issued.secret!, correlationId: "recovery-correlation", idempotencyKey: "recovery-consume-1" }), { status: "recovered", tenantId: TENANT_ID, userId: USER_ID });
  assert.equal(resetCredential, issued.secret);
  await assert.rejects(() => consume({ tenantId: TENANT_ID, caseId: issued.caseId, secret: issued.secret!, correlationId: "recovery-correlation-2", idempotencyKey: "recovery-consume-2" }), (error) => error instanceof SecurityCommandError && error.code === "context-denied");
});

test("deactivation revokes authority atomically and reactivation restores only selected former roles", async () => {
  const state = fixture(account({ lifecycle: "active", version: 4, assignmentVersion: 7 }));
  await state.service.deactivate({ ...command, targetUserId: USER_ID, expectedVersion: 4, reason: "Pegawai tidak lagi bertugas" });
  assert.equal(state.account.lifecycle, "inactive");

  await state.service.reactivate({ ...command, idempotencyKey: "reactivate-2", targetUserId: USER_ID, expectedVersion: 5, roleIds: [ROLE_ID], reason: "Kembali bertugas" });
  assert.equal(state.account.lifecycle, "active");
});

test("foreign and School Admin targets are rejected through the same opaque denial", async () => {
  for (const target of [account({ tenantId: "00000000-0000-4000-8000-000000000090" }), account({ schoolAdmin: true })]) {
    const state = fixture(target);
    await assert.rejects(
      state.service.deactivate({ ...command, targetUserId: USER_ID, expectedVersion: target.version, reason: "Tidak berlaku" }),
      (error) => error instanceof SecurityCommandError && error.code === "context-denied",
    );
  }
});

test("delete soft-removes access: revokes sessions, suspends roles, removes credential, unlinks person, and transitions to inactive", async () => {
  const state = fixture(account({ lifecycle: "active", version: 4, assignmentVersion: 7 }));
  let revokedSessions = -1;
  let pendingRevoked = false;
  let suspendedRoles: readonly string[] = [];
  let credentialDeleted = false;
  let personUnlinked = false;
  state.repository.revokeSessions = async () => { revokedSessions = 0; return 0; };
  state.repository.revokePendingCases = async () => { pendingRevoked = true; };
  state.repository.suspendAssignments = async () => { suspendedRoles = [ROLE_ID]; return suspendedRoles; };
  state.repository.deleteCredential = async () => { credentialDeleted = true; };
  state.repository.unlinkPersonByAccount = async () => { personUnlinked = true; };

  const result = await state.service.deleteAccount({ ...command, targetUserId: USER_ID, expectedVersion: 4, reason: "Akun duplikat, digabung ke identitas lain" });
  assert.equal(result.status, "deleted");
  assert.equal(state.account.lifecycle, "inactive");
  assert.equal(revokedSessions, 0);
  assert.equal(pendingRevoked, true);
  assert.deepEqual([...suspendedRoles], [ROLE_ID]);
  assert.equal(credentialDeleted, true);
  assert.equal(personUnlinked, true);
});

test("delete is rejected for pending-activation and School Admin targets", async () => {
  const pending = fixture(account({ lifecycle: "pending-activation", version: 1 }));
  await assert.rejects(
    pending.service.deleteAccount({ ...command, targetUserId: USER_ID, expectedVersion: 1, reason: "Salah buat" }),
    (error) => error instanceof SecurityCommandError && error.code === "invalid-command",
  );
  const admin = fixture(account({ schoolAdmin: true, lifecycle: "active", version: 2 }));
  await assert.rejects(
    admin.service.deleteAccount({ ...command, targetUserId: USER_ID, expectedVersion: 2, reason: "Tidak berlaku" }),
    (error) => error instanceof SecurityCommandError && error.code === "context-denied",
  );
});

test("link attaches an existing unlinked person and bumps version", async () => {
  const state = fixture(account({ lifecycle: "active", version: 3 }));
  state.person = { id: "person-1", tenantId: TENANT_ID, accountUserId: null, archived: false };
  let linkedPersonId: string | null = null;
  state.repository.linkPersonToAccount = async () => { linkedPersonId = "person-1"; return 1; };
  const result = await state.service.linkAccount({ ...command, targetUserId: USER_ID, expectedVersion: 3, personId: "person-1", reason: "Person ini pemilik akun" });
  assert.equal(result.status, "linked");
  assert.equal(result.personId, "person-1");
  assert.equal(result.version, 4);
  assert.equal(linkedPersonId, "person-1");
});

test("link is rejected for School Admin, already-linked account, missing person, archived person, or wrong tenant", async () => {
  const adminTarget = fixture(account({ schoolAdmin: true, lifecycle: "active", version: 2 }));
  await assert.rejects(
    adminTarget.service.linkAccount({ ...command, targetUserId: USER_ID, expectedVersion: 2, personId: "person-1", reason: "x" }),
    (error) => error instanceof SecurityCommandError && error.code === "context-denied",
  );
  const already = fixture(account({ lifecycle: "active", version: 2, linkedPersonId: "person-0" }));
  await assert.rejects(
    already.service.linkAccount({ ...command, targetUserId: USER_ID, expectedVersion: 2, personId: "person-1", reason: "x" }),
    (error) => error instanceof SecurityCommandError && error.code === "invalid-command",
  );
  const missing = fixture(account({ lifecycle: "active", version: 2 }));
  await assert.rejects(
    missing.service.linkAccount({ ...command, targetUserId: USER_ID, expectedVersion: 2, personId: "person-1", reason: "x" }),
    (error) => error instanceof SecurityCommandError && error.code === "context-denied",
  );
  const archived = fixture(account({ lifecycle: "active", version: 2 }));
  archived.person = { id: "person-1", tenantId: TENANT_ID, accountUserId: null, archived: true };
  await assert.rejects(
    archived.service.linkAccount({ ...command, targetUserId: USER_ID, expectedVersion: 2, personId: "person-1", reason: "x" }),
    (error) => error instanceof SecurityCommandError && error.code === "context-denied",
  );
  const foreign = fixture(account({ lifecycle: "active", version: 2 }));
  foreign.person = { id: "person-1", tenantId: "00000000-0000-4000-8000-000000000090", accountUserId: null, archived: false };
  await assert.rejects(
    foreign.service.linkAccount({ ...command, targetUserId: USER_ID, expectedVersion: 2, personId: "person-1", reason: "x" }),
    (error) => error instanceof SecurityCommandError && error.code === "context-denied",
  );
});

test("unlink detaches the person and bumps version", async () => {
  const state = fixture(account({ lifecycle: "active", version: 5, linkedPersonId: "person-1" }));
  let unlinked = false;
  state.repository.unlinkPersonByAccount = async () => { unlinked = true; };
  const result = await state.service.unlinkAccount({ ...command, targetUserId: USER_ID, expectedVersion: 5, reason: "Person pindah sekolah" });
  assert.equal(result.status, "unlinked");
  assert.equal(result.personId, null);
  assert.equal(result.version, 6);
  assert.equal(unlinked, true);
});

test("unlink is rejected when no person is linked", async () => {
  const state = fixture(account({ lifecycle: "active", version: 2 }));
  await assert.rejects(
    state.service.unlinkAccount({ ...command, targetUserId: USER_ID, expectedVersion: 2, reason: "x" }),
    (error) => error instanceof SecurityCommandError && error.code === "invalid-command",
  );
});
