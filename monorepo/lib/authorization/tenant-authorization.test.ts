import assert from "node:assert/strict";
import test from "node:test";

import {
  TENANT_AUTHORIZATION_RESOLVER_VERSION,
  createTenantAuthorizationEvaluator,
  type TenantAuthorizationAccount,
  type TenantAuthorizationAuthority,
  type TenantAuthorizationRollout,
  type TenantAuthorizationStore,
  type TenantAuthorizationTenant,
} from "@/lib/authorization/tenant-authorization";
import { OPERATION_MAP_VERSION, PERMISSION_REGISTRY_VERSION } from "@/lib/authorization/tenant-rbac-contract";
import { emergencyOverlayDigest } from "@/lib/authorization/tenant-rbac-rollout";
import { TENANT_FEATURES } from "@/lib/features/tenant-feature-policy";

const allFeatures = {
  features: Object.fromEntries(TENANT_FEATURES.map((feature) => [feature.key, true])),
};

const activeAccount: TenantAuthorizationAccount = {
  userId: "user-1",
  tenantId: "tenant-1",
  accountLifecycle: "active",
  providerAdmin: false,
  applicant: false,
  activationComplete: true,
};
const activeTenant: TenantAuthorizationTenant = {
  id: "tenant-1",
  domain: "school.example",
  npsn: "20100001",
  operationalStatus: "active",
  trialEndsAt: null,
  settings: allFeatures,
};
const rbacRollout: TenantAuthorizationRollout = {
  httpMode: "rbac",
  workerMode: "rbac",
  epoch: BigInt(7),
  resolverVersion: TENANT_AUTHORIZATION_RESOLVER_VERSION,
  registryVersion: PERMISSION_REGISTRY_VERSION,
  operationMapVersion: OPERATION_MAP_VERSION,
  emergencyOverlay: null,
};

function authority(permissionKeys: readonly string[] = []): TenantAuthorizationAuthority {
  return {
    schoolAdminAuthorityStates: [],
    assignments: permissionKeys.length ? [{
      assignmentId: "assignment-1",
      assignmentState: "active",
      roleId: "role-1",
      roleLifecycle: "active",
      permissionKeys,
    }] : [],
  };
}

function fixture(overrides: Partial<{
  account: TenantAuthorizationAccount | null;
  tenant: TenantAuthorizationTenant | null;
  authority: TenantAuthorizationAuthority;
  rollout: TenantAuthorizationRollout | null;
}> = {}) {
  const values = {
    account: activeAccount as TenantAuthorizationAccount | null,
    tenant: activeTenant as TenantAuthorizationTenant | null,
    authority: authority(),
    rollout: rbacRollout as TenantAuthorizationRollout | null,
    ...overrides,
  };
  const calls = { account: 0, tenant: 0, authority: 0, rollout: 0 };
  const store: TenantAuthorizationStore = {
    async loadAccount() { calls.account += 1; return values.account; },
    async loadTenantByDomain() { calls.tenant += 1; return values.tenant; },
    async loadAuthority() { calls.authority += 1; return values.authority; },
    async loadRollout() { calls.rollout += 1; return values.rollout; },
  };
  return { store, calls };
}

const dashboardRequest = {
  sessionUserId: "user-1",
  domain: "school.example",
  operationId: "tenant.dashboard.load",
  surface: "page" as const,
};

test("RBAC denies an active account without authoritative assignments", async () => {
  const { store } = fixture();
  const result = await createTenantAuthorizationEvaluator({ store }).evaluate(dashboardRequest);

  assert.equal(result.kind, "denied");
  assert.equal(result.mode, "rbac");
  assert.equal(result.rbac.allowed, false);
  assert.equal(result.rbac.denial?.code, "permission-denied");
  assert.equal("legacy" in result, false);
});

test("authority store failures fail closed for reads and mutations", async () => {
  for (const request of [
    dashboardRequest,
    { ...dashboardRequest, operationId: "tenant-settings.landing-page.update", surface: "api" as const },
  ]) {
    const unavailable = fixture();
    unavailable.store.loadAuthority = async () => { throw new Error("unavailable"); };
    const result = await createTenantAuthorizationEvaluator({ store: unavailable.store }).evaluate(request);
    assert.equal(result.kind, "denied");
    if (result.kind === "denied") assert.equal(result.internal.code, "store-unavailable");
  }
});

test("the evaluator memoizes persistence reads only within its request-local instance", async () => {
  const { store, calls } = fixture({ authority: authority(["tenant.dashboard.view"]) });
  const evaluator = createTenantAuthorizationEvaluator({ store });
  await evaluator.evaluate(dashboardRequest);
  await evaluator.evaluate(dashboardRequest);
  assert.deepEqual(calls, { account: 1, tenant: 1, authority: 1, rollout: 1 });

  await createTenantAuthorizationEvaluator({ store }).evaluate(dashboardRequest);
  assert.deepEqual(calls, { account: 2, tenant: 2, authority: 2, rollout: 2 });
});

test("fail-closed ordering stops before Tenant and authority reads when authentication is missing", async () => {
  const { store, calls } = fixture();
  const result = await createTenantAuthorizationEvaluator({ store }).evaluate({
    ...dashboardRequest,
    sessionUserId: null,
  });
  assert.equal(result.kind, "denied");
  if (result.kind === "denied") {
    assert.deepEqual(result.external, { kind: "login-required", status: 401 });
    assert.equal(result.internal.code, "no-session");
  }
  assert.deepEqual(calls, { account: 0, tenant: 0, authority: 0, rollout: 0 });
});

test("foreign Tenant membership is concealed and never loads authority", async () => {
  const { store, calls } = fixture({ account: { ...activeAccount, tenantId: "tenant-other" } });
  const result = await createTenantAuthorizationEvaluator({ store }).evaluate(dashboardRequest);
  assert.equal(result.kind, "denied");
  if (result.kind === "denied") {
    assert.deepEqual(result.external, { kind: "not-found", status: 404 });
    assert.equal(result.internal.code, "tenant-mismatch");
  }
  assert.equal(calls.authority, 0);
});

test("inactive, conflicting identity, and incomplete activation states grant no RBAC authority", async () => {
  for (const [account, code] of [
    [{ ...activeAccount, accountLifecycle: "inactive" }, "account-inactive"],
    [{ ...activeAccount, providerAdmin: true }, "identity-kind-rejected"],
    [{ ...activeAccount, activationComplete: false }, "activation-incomplete"],
  ] as const) {
    const { store } = fixture({ account });
    const result = await createTenantAuthorizationEvaluator({ store }).evaluate(dashboardRequest);
    assert.equal(result.rbac.allowed, false);
    assert.equal(result.rbac.denial?.code, code);
  }
});

test("dedicated School Admin authority is active only at exact valid cardinality", async () => {
  const active = fixture({ authority: { schoolAdminAuthorityStates: ["active"], assignments: [] } });
  const first = await createTenantAuthorizationEvaluator({ store: active.store }).evaluate(dashboardRequest);
  assert.equal(first.kind, "authorized");
  assert.equal(first.rbac.allowed, true);

  for (const schoolAdminAuthorityStates of [[], ["disabled"], ["unknown"], ["active", "active"]]) {
    const malformed = fixture({ authority: { schoolAdminAuthorityStates, assignments: [] } });
    const result = await createTenantAuthorizationEvaluator({ store: malformed.store }).evaluate(dashboardRequest);
    assert.equal(result.kind, "denied");
    assert.equal(result.rbac.denial?.code, "permission-denied");
  }
});

test("unknown and inactive grants are ignored rather than widening effective access", async () => {
  const { store } = fixture({
    authority: {
      schoolAdminAuthorityStates: [],
      assignments: [
        { assignmentId: "a", assignmentState: "active", roleId: "active", roleLifecycle: "active", permissionKeys: ["future.unknown.allow"] },
        { assignmentId: "b", assignmentState: "suspended", roleId: "suspended", roleLifecycle: "active", permissionKeys: ["tenant.dashboard.view"] },
        { assignmentId: "c", assignmentState: "active", roleId: "archived", roleLifecycle: "archived", permissionKeys: ["tenant.dashboard.view"] },
        { assignmentId: "d", assignmentState: "active", roleId: "incomplete", roleLifecycle: "active", permissionKeys: ["tenant.users.view-contact"] },
      ],
    },
  });
  const result = await createTenantAuthorizationEvaluator({ store }).evaluate(dashboardRequest);
  assert.equal(result.rbac.allowed, false);
  assert.equal(result.rbac.denial?.code, "permission-denied");
});

test("assigned contextual access requires a matching declared arm", async () => {
  const rollout = { ...rbacRollout };
  const request = {
    sessionUserId: "user-1",
    domain: "school.example",
    operationId: "quizzes.sessions.load",
    surface: "api" as const,
  };
  const { store } = fixture({ authority: authority(["quizzes.sessions.view"]), rollout });
  const withoutContext = await createTenantAuthorizationEvaluator({ store }).evaluate(request);
  assert.equal(withoutContext.kind, "denied");
  assert.equal(withoutContext.rbac.denial?.code, "scope-denied");

  const allowed = await createTenantAuthorizationEvaluator({ store }).evaluate({
    ...request,
    context: { policy: "assigned", async evaluate() { return { allowed: true, arm: "assigned" }; } },
  });
  assert.equal(allowed.kind, "authorized");
});

test("absensi page load requires absensi.attendance.view", async () => {
  const absensiRequest = {
    sessionUserId: "user-1",
    domain: "school.example",
    operationId: "absensi.attendance.load",
    surface: "page" as const,
  };

  const withoutKey = fixture({ authority: authority(["tenant.dashboard.view"]) });
  const denied = await createTenantAuthorizationEvaluator({ store: withoutKey.store }).evaluate(absensiRequest);
  assert.equal(denied.kind, "denied");
  assert.equal(denied.rbac.allowed, false);
  assert.equal(denied.rbac.denial?.code, "permission-denied");

  const withKey = fixture({ authority: authority(["absensi.attendance.view"]) });
  const allowed = await createTenantAuthorizationEvaluator({ store: withKey.store }).evaluate(absensiRequest);
  assert.equal(allowed.kind, "authorized");
  if (allowed.kind === "authorized") assert.equal(allowed.rbac.allowed, true);
});

test("admin-only placeholder pages require tenant.authorization-audit.view", async () => {
  const adminOnlyOperationIds = [
    "e-library.load",
    "jadwal.mengajar.load",
    "jadwal.events.load",
    "persuratan.load",
    "settings.backup-restore.load",
    "integrasi.whatsapp-bot.load",
  ];

  const nonAdmin = fixture({ authority: authority(["tenant.dashboard.view", "absensi.attendance.view"]) });
  const admin = fixture({
    authority: { schoolAdminAuthorityStates: ["active"], assignments: [] },
  });

  for (const operationId of adminOnlyOperationIds) {
    const request = { sessionUserId: "user-1", domain: "school.example", operationId, surface: "page" as const };

    const denied = await createTenantAuthorizationEvaluator({ store: nonAdmin.store }).evaluate(request);
    assert.equal(denied.kind, "denied", operationId);
    assert.equal(denied.rbac.allowed, false, operationId);
    assert.equal(denied.rbac.denial?.code, "permission-denied", operationId);

    const allowed = await createTenantAuthorizationEvaluator({ store: admin.store }).evaluate(request);
    assert.equal(allowed.kind, "authorized", operationId);
    if (allowed.kind === "authorized") assert.equal(allowed.rbac.allowed, true, operationId);
  }
});

test("read-only Tenant state is checked before entitlements and permissions", async () => {
  const { store } = fixture({
    tenant: { ...activeTenant, operationalStatus: "suspended", settings: { features: {} } },
    authority: authority(["tenant-settings.landing-page.update"]),
  });
  const result = await createTenantAuthorizationEvaluator({ store }).evaluate({
    ...dashboardRequest,
    operationId: "tenant-settings.landing-page.update",
    surface: "api",
  });
  assert.equal(result.rbac.denial?.code, "read-only");
  assert.equal(result.rbac.denial?.stage, "tenant-state");
});

test("a missing rollout record fails closed instead of guessing an authority mode", async () => {
  const { store } = fixture({
    authority: authority(["tenant.dashboard.view"]),
    rollout: null,
  });
  const result = await createTenantAuthorizationEvaluator({ store }).evaluate(dashboardRequest);
  assert.equal(result.kind, "denied");
  if (result.kind === "denied") assert.equal(result.internal.code, "rollout-missing");
});

test("stale and unsupported rollout state fails closed for HTTP and worker mutations", async () => {
  const account = activeAccount;
  const adminAuthority: TenantAuthorizationAuthority = { schoolAdminAuthorityStates: ["active"], assignments: [] };
  const baseRequest = {
    sessionUserId: "user-1",
    domain: "school.example",
    operationId: "tenant-settings.landing-page.update",
  };

  const unsupported = fixture({
    account,
    authority: adminAuthority,
    rollout: { ...rbacRollout, resolverVersion: "unsupported@99" },
  });
  const httpResult = await createTenantAuthorizationEvaluator({ store: unsupported.store }).evaluate({
    ...baseRequest,
    surface: "api",
  });
  assert.equal(httpResult.kind, "denied");
  if (httpResult.kind === "denied") assert.equal(httpResult.internal.code, "rollout-version-unsupported");

  const stale = fixture({ account, authority: adminAuthority });
  const workerResult = await createTenantAuthorizationEvaluator({ store: stale.store }).evaluate({
    ...baseRequest,
    surface: "worker",
    expectedRolloutEpoch: BigInt(6),
  });
  assert.equal(workerResult.kind, "denied");
  if (workerResult.kind === "denied") assert.equal(workerResult.internal.code, "rollout-epoch-stale");
});

test("legacy and intersection rollout modes are rejected on HTTP and worker surfaces", async () => {
  const adminAuthority: TenantAuthorizationAuthority = { schoolAdminAuthorityStates: ["active"], assignments: [] };
  for (const mode of ["legacy", "intersection"] as const) {
    for (const surface of ["api", "worker"] as const) {
      const rollout: TenantAuthorizationRollout = {
        ...rbacRollout,
        httpMode: surface === "api" ? mode : "rbac",
        workerMode: surface === "worker" ? mode : "rbac",
      };
      const { store } = fixture({ authority: adminAuthority, rollout });
      const result = await createTenantAuthorizationEvaluator({ store }).evaluate({
        ...dashboardRequest,
        surface,
      });
      assert.equal(result.kind, "denied");
      assert.equal(result.rbac.denial?.code, "rollout-version-unsupported");
    }
  }
});

test("persisted emergency policy can only narrow an otherwise valid RBAC mutation", async () => {
  const body = {
    deniedOperationIds: [] as readonly string[],
    deniedPermissionKeys: [] as readonly string[],
    denyMutations: true,
    policyVersion: "emergency@1",
    reviewAt: new Date("2026-08-01T00:00:00.000Z"),
    expiresAt: new Date("2026-08-03T00:00:00.000Z"),
  };
  const rollout: TenantAuthorizationRollout = {
    ...rbacRollout,
    httpMode: "rbac-emergency",
    workerMode: "rbac-emergency",
    emergencyOverlay: { ...body, overlayHash: emergencyOverlayDigest(body) },
  };
  const { store } = fixture({
    authority: { schoolAdminAuthorityStates: ["active"], assignments: [] },
    rollout,
  });
  const result = await createTenantAuthorizationEvaluator({
    store,
    now: () => new Date("2026-08-02T00:00:00.000Z"),
  }).evaluate({
    sessionUserId: "user-1",
    domain: "school.example",
    operationId: "tenant-settings.landing-page.update",
    surface: "api",
  });
  assert.equal(result.kind, "denied");
  assert.equal(result.rbac.denial?.code, "permission-denied");

  const workerResult = await createTenantAuthorizationEvaluator({
    store,
    now: () => new Date("2026-08-02T00:00:00.000Z"),
  }).evaluate({
    sessionUserId: "user-1",
    domain: "school.example",
    operationId: "tenant-settings.landing-page.update",
    surface: "worker",
    expectedRolloutEpoch: rollout.epoch,
  });
  assert.equal(workerResult.kind, "denied");
  assert.equal(workerResult.rbac.denial?.code, "permission-denied");

  const malformed = fixture({
    authority: { schoolAdminAuthorityStates: ["active"], assignments: [] },
    rollout: { ...rollout, emergencyOverlay: { ...rollout.emergencyOverlay!, overlayHash: "a".repeat(64) } },
  });
  const malformedResult = await createTenantAuthorizationEvaluator({
    store: malformed.store,
    now: () => new Date("2026-08-02T00:00:00.000Z"),
  }).evaluate({
    sessionUserId: "user-1",
    domain: "school.example",
    operationId: "tenant-settings.landing-page.update",
    surface: "api",
  });
  assert.equal(malformedResult.kind, "denied");
  assert.equal(malformedResult.rbac.denial?.code, "emergency-policy-unsupported");

  const expiredResult = await createTenantAuthorizationEvaluator({
    store,
    now: () => new Date("2026-08-04T00:00:00.000Z"),
  }).evaluate({
    sessionUserId: "user-1",
    domain: "school.example",
    operationId: "tenant-settings.landing-page.update",
    surface: "api",
  });
  assert.equal(expiredResult.kind, "denied");
  assert.equal(expiredResult.rbac.denial?.code, "emergency-policy-unsupported");
});
