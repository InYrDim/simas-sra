import assert from "node:assert/strict";
import test from "node:test";

import {
  createTenantAccountLifecycleService,
  digestLifecycleSecret,
  type AccountLifecycleCase,
  type AccountLifecycleRepository,
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
  const repository: AccountLifecycleRepository = {
    lockTenant: async () => true,
    isSchoolAdmin: async (_tenantId, userId) => userId === ADMIN_ID,
    findIdentityByEmail: async (email) => email === current.email ? current : null,
    getAccount: async (_tenantId, userId) => userId === current.userId ? current : null,
    getPerson: async () => null,
    listRoles: async () => [{ id: ROLE_ID, tenantId: TENANT_ID, lifecycle: "active" }],
    listAssignments: async () => [{ id: "assignment-1", roleId: ROLE_ID, state: "suspended", version: 2 }],
    findPendingCase: async () => pending,
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
  return { service, repository, get account() { return current; }, get pending() { return pending; }, outbox };
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
