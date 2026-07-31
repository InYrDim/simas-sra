import assert from "node:assert/strict";
import test from "node:test";

import {
  TENANT_AUTHORIZATION_RESOLVER_VERSION,
  createTenantAuthorizationEvaluator,
  type TenantAuthorizationAccount,
  type TenantAuthorizationAuthority,
  type TenantAuthorizationRollout,
  type TenantAuthorizationShadowComparison,
  type TenantAuthorizationStore,
  type TenantAuthorizationTenant,
} from "@/lib/authorization/tenant-authorization";
import { OPERATION_MAP_VERSION, PERMISSION_REGISTRY_VERSION } from "@/lib/authorization/tenant-rbac-contract";
import { TENANT_FEATURES } from "@/lib/features/tenant-feature-policy";

const allFeatures = {
  features: Object.fromEntries(TENANT_FEATURES.map((feature) => [feature.key, true])),
};

const activeAccount: TenantAuthorizationAccount = {
  userId: "user-1",
  tenantId: "tenant-1",
  legacyRole: "staff",
  accountLifecycle: "active",
  providerAdmin: false,
  applicant: false,
  activationComplete: true,
};
const activeTenant: TenantAuthorizationTenant = {
  id: "tenant-1",
  domain: "school.example",
  operationalStatus: "active",
  trialEndsAt: null,
  settings: allFeatures,
};
const legacyRollout: TenantAuthorizationRollout = {
  httpMode: "legacy",
  workerMode: "legacy",
  epoch: BigInt(7),
  resolverVersion: TENANT_AUTHORIZATION_RESOLVER_VERSION,
  registryVersion: PERMISSION_REGISTRY_VERSION,
  operationMapVersion: OPERATION_MAP_VERSION,
  overlayHash: null,
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
    rollout: legacyRollout as TenantAuthorizationRollout | null,
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

test("shadow mode records an RBAC denial but preserves the legacy-visible allow", async () => {
  const comparisons: TenantAuthorizationShadowComparison[] = [];
  const { store } = fixture();
  const result = await createTenantAuthorizationEvaluator({
    store,
    comparisonRecorder: { record(value) { comparisons.push(value); } },
  }).evaluate(dashboardRequest);

  assert.equal(result.kind, "authorized");
  assert.equal(result.legacy.allowed, true);
  assert.equal(result.rbac.allowed, false);
  assert.equal(result.rbac.denial?.code, "permission-denied");
  assert.deepEqual(comparisons, [{
    direction: "legacy-only",
    operationId: "tenant.dashboard.load",
    surface: "page",
    mode: "legacy",
    rolloutEpoch: "7",
    resolverVersion: TENANT_AUTHORIZATION_RESOLVER_VERSION,
    registryVersion: PERMISSION_REGISTRY_VERSION,
    operationMapVersion: OPERATION_MAP_VERSION,
    legacyAllowed: true,
    rbacAllowed: false,
    rbacDenialCode: "permission-denied",
  }]);
  assert.equal(JSON.stringify(comparisons).includes("user-1"), false);
  assert.equal(JSON.stringify(comparisons).includes("tenant-1"), false);
  assert.equal(JSON.stringify(comparisons).includes("school.example"), false);
});

test("shadow read failures stay non-authoritative while mutation store failures fail closed", async () => {
  const readFixture = fixture();
  readFixture.store.loadAuthority = async () => { throw new Error("unavailable"); };
  const read = await createTenantAuthorizationEvaluator({ store: readFixture.store }).evaluate(dashboardRequest);
  assert.equal(read.kind, "authorized");
  assert.equal(read.legacy.allowed, true);
  assert.equal(read.rbac.denial?.code, "store-unavailable");

  const mutationFixture = fixture({ account: { ...activeAccount, legacyRole: "school-admin" } });
  mutationFixture.store.loadAuthority = async () => { throw new Error("unavailable"); };
  const mutation = await createTenantAuthorizationEvaluator({ store: mutationFixture.store }).evaluate({
    ...dashboardRequest,
    operationId: "tenant-settings.landing-page.update",
    surface: "api",
  });
  assert.equal(mutation.kind, "denied");
  if (mutation.kind === "denied") assert.equal(mutation.internal.code, "store-unavailable");
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

test("School Admin compatibility is equivalent and dedicated revocation is visible on the next request", async () => {
  const account = { ...activeAccount, legacyRole: "school-admin" };
  const compatible = fixture({
    account,
    authority: { schoolAdminAuthorityStates: ["active"], assignments: [] },
  });
  const first = await createTenantAuthorizationEvaluator({ store: compatible.store }).evaluate(dashboardRequest);
  assert.equal(first.kind, "authorized");
  assert.equal(first.legacy.allowed, true);
  assert.equal(first.rbac.allowed, true);

  const revoked = fixture({
    account,
    authority: { schoolAdminAuthorityStates: ["disabled"], assignments: [] },
    rollout: { ...legacyRollout, httpMode: "intersection" },
  });
  const nextRequest = await createTenantAuthorizationEvaluator({ store: revoked.store }).evaluate(dashboardRequest);
  assert.equal(nextRequest.kind, "denied");
  assert.equal(nextRequest.legacy.allowed, true);
  assert.equal(nextRequest.rbac.allowed, false);
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
  const rbacRollout = { ...legacyRollout, httpMode: "rbac" as const };
  const request = {
    sessionUserId: "user-1",
    domain: "school.example",
    operationId: "quizzes.sessions.load",
    surface: "api" as const,
  };
  const { store } = fixture({ authority: authority(["quizzes.sessions.view"]), rollout: rbacRollout });
  const withoutContext = await createTenantAuthorizationEvaluator({ store }).evaluate(request);
  assert.equal(withoutContext.kind, "denied");
  assert.equal(withoutContext.rbac.denial?.code, "scope-denied");

  const allowed = await createTenantAuthorizationEvaluator({ store }).evaluate({
    ...request,
    context: { policy: "assigned", async evaluate() { return { allowed: true, arm: "assigned" }; } },
  });
  assert.equal(allowed.kind, "authorized");
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

test("stale and unsupported rollout state fails closed for HTTP and worker mutations in legacy mode", async () => {
  const account = { ...activeAccount, legacyRole: "school-admin" };
  const adminAuthority: TenantAuthorizationAuthority = { schoolAdminAuthorityStates: ["active"], assignments: [] };
  const baseRequest = {
    sessionUserId: "user-1",
    domain: "school.example",
    operationId: "tenant-settings.landing-page.update",
  };

  const unsupported = fixture({
    account,
    authority: adminAuthority,
    rollout: { ...legacyRollout, resolverVersion: "unsupported@99" },
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

test("emergency policy can only narrow an otherwise valid RBAC mutation", async () => {
  const rollout: TenantAuthorizationRollout = {
    ...legacyRollout,
    httpMode: "rbac-emergency",
    workerMode: "rbac-emergency",
    overlayHash: "deny-writes",
  };
  const { store } = fixture({
    account: { ...activeAccount, legacyRole: "school-admin" },
    authority: { schoolAdminAuthorityStates: ["active"], assignments: [] },
    rollout,
  });
  const result = await createTenantAuthorizationEvaluator({
    store,
    emergencyPolicies: [{ overlayHash: "deny-writes", denyMutations: true }],
  }).evaluate({
    sessionUserId: "user-1",
    domain: "school.example",
    operationId: "tenant-settings.landing-page.update",
    surface: "api",
  });
  assert.equal(result.kind, "denied");
  assert.equal(result.rbac.denial?.code, "permission-denied");
});
