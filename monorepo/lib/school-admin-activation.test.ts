import assert from "node:assert/strict";
import test from "node:test";

import {
  createChangeSchoolAdminPasswordCommand,
  createRecordFirstAuthenticationCommand,
  createResetTemporaryCredentialCommand,
  requireActivatedTenantPrincipal,
  TemporaryCredentialResetDeniedError,
  type SchoolAdminActivationStore,
} from "@/lib/school-admin-activation";

function activationStore(state: {
  firstAuthenticatedAt: Date | null;
  passwordChangeRequired: boolean;
}) {
  const events: string[] = [];
  let credentialHash = "hash:temporary";
  const store: SchoolAdminActivationStore = {
    async recordFirstAuthentication(userId, authenticatedAt) {
      events.push(`first-auth:${userId}:${authenticatedAt.toISOString()}`);
    },
    async getTenantPrincipal(userId) {
      events.push(`principal:${userId}`);
      return {
        userId,
        tenantId: "tenant-1",
        tenantRole: "school-admin",
        passwordChangeRequired: state.passwordChangeRequired,
      };
    },
    async transaction(work) {
      events.push("transaction");
      return work({
        async lock(userId) {
          events.push(`lock:${userId}`);
          return { userId, ...state };
        },
        async getCredentialHash(userId) {
          events.push(`credential:${userId}`);
          return credentialHash;
        },
        async replaceCredential(userId, hash) {
          events.push(`replace:${userId}`);
          credentialHash = hash;
        },
        async revokeOtherSessions(userId, currentSessionId) {
          events.push(`revoke-other:${userId}:${currentSessionId}`);
        },
        async revokeAllSessions(userId) {
          events.push(`revoke-all:${userId}`);
        },
        async completePasswordChange(userId, changedAt) {
          events.push(`changed:${userId}:${changedAt.toISOString()}`);
          state.passwordChangeRequired = false;
        },
        async reissueTemporaryCredential(userId, issuedAt) {
          events.push(`reissued:${userId}:${issuedAt.toISOString()}`);
        },
      });
    },
  };
  return { events, store };
}

test("successful authentication records the first authentication idempotently", async () => {
  const { events, store } = activationStore({ firstAuthenticatedAt: null, passwordChangeRequired: true });
  const record = createRecordFirstAuthenticationCommand({
    now: () => new Date("2026-07-18T10:00:00.000Z"),
    store,
  });

  await record("school-admin-1");
  await record("school-admin-1");

  assert.deepEqual(events, [
    "first-auth:school-admin-1:2026-07-18T10:00:00.000Z",
    "first-auth:school-admin-1:2026-07-18T10:00:00.000Z",
  ]);
});

test("tenant authorization blocks features until the temporary credential is replaced", async () => {
  const pending = activationStore({ firstAuthenticatedAt: new Date(), passwordChangeRequired: true });
  await assert.rejects(
    () => requireActivatedTenantPrincipal("school-admin-1", "tenant-1", pending.store),
    (error: unknown) => (error as { code?: string }).code === "password-change-required",
  );

  const active = activationStore({ firstAuthenticatedAt: new Date(), passwordChangeRequired: false });
  assert.deepEqual(
    await requireActivatedTenantPrincipal("school-admin-1", "tenant-1", active.store),
    { userId: "school-admin-1", tenantId: "tenant-1", tenantRole: "school-admin" },
  );
});

test("password change verifies the previous password, revokes other sessions, and clears the requirement", async () => {
  const { events, store } = activationStore({ firstAuthenticatedAt: new Date(), passwordChangeRequired: true });
  const changePassword = createChangeSchoolAdminPasswordCommand({
    hashPassword: async (password) => `hash:${password}`,
    now: () => new Date("2026-07-18T11:00:00.000Z"),
    store,
    verifyPassword: async ({ hash, password }) => hash === `hash:${password}`,
  });

  assert.deepEqual(await changePassword({
    userId: "school-admin-1",
    currentSessionId: "session-current",
    currentPassword: "temporary",
    newPassword: "permanent-password",
  }), { ok: true });

  assert.deepEqual(events, [
    "transaction",
    "lock:school-admin-1",
    "credential:school-admin-1",
    "replace:school-admin-1",
    "revoke-other:school-admin-1:session-current",
    "changed:school-admin-1:2026-07-18T11:00:00.000Z",
  ]);
});

test("password change rejects an incorrect previous password without mutation", async () => {
  const { events, store } = activationStore({ firstAuthenticatedAt: new Date(), passwordChangeRequired: true });
  const changePassword = createChangeSchoolAdminPasswordCommand({
    hashPassword: async () => "unused",
    store,
    verifyPassword: async () => false,
  });

  assert.deepEqual(await changePassword({
    userId: "school-admin-1",
    currentSessionId: "session-current",
    currentPassword: "wrong",
    newPassword: "permanent-password",
  }), { ok: false, code: "invalid-current-password" });
  assert.deepEqual(events, ["transaction", "lock:school-admin-1", "credential:school-admin-1"]);
});

test("Provider Admin can reset a temporary credential only before first authentication", async () => {
  const beforeLogin = activationStore({ firstAuthenticatedAt: null, passwordChangeRequired: true });
  const reset = createResetTemporaryCredentialCommand({
    authorize: async () => ({ userId: "provider-1", name: "Provider", email: "provider@test" }),
    generateCredential: () => "replacement-secret",
    hashPassword: async (password) => `hash:${password}`,
    now: () => new Date("2026-07-18T12:00:00.000Z"),
    store: beforeLogin.store,
  });

  assert.deepEqual(await reset("school-admin-1"), {
    ok: true,
    temporaryCredential: "replacement-secret",
  });
  assert.deepEqual(beforeLogin.events, [
    "transaction",
    "lock:school-admin-1",
    "replace:school-admin-1",
    "revoke-all:school-admin-1",
    "reissued:school-admin-1:2026-07-18T12:00:00.000Z",
  ]);

  const afterLogin = activationStore({ firstAuthenticatedAt: new Date(), passwordChangeRequired: true });
  const denied = createResetTemporaryCredentialCommand({
    authorize: async () => ({ userId: "provider-1", name: "Provider", email: "provider@test" }),
    generateCredential: () => "unused",
    hashPassword: async () => "unused",
    store: afterLogin.store,
  });
  await assert.rejects(() => denied("school-admin-1"), TemporaryCredentialResetDeniedError);
  assert.deepEqual(afterLogin.events, ["transaction", "lock:school-admin-1"]);
});
