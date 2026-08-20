import assert from "node:assert/strict";
import test from "node:test";

import {
  TENANT_AUTHORIZATION_RESOLVER_VERSION,
  createTenantAuthorizationEvaluator,
  type TenantAuthorizationAccount,
  type TenantAuthorizationAuthority,
  type TenantAuthorizationStore,
} from "@/lib/authorization/tenant-authorization";
import {
  OPERATION_MAP_VERSION,
  PERMISSION_REGISTRY_VERSION,
  resolveActivePermission,
  tenantOperationMap,
  type TenantOperationDefinition,
} from "@/lib/authorization/tenant-rbac-contract";
import { TENANT_FEATURES } from "@/lib/features/tenant-feature-policy";

const generatedOperations = tenantOperationMap.filter((operation) =>
  operation.classification === "tenant-rbac" && operation.lifecycle === "active",
);
const enabledSettings = {
  features: Object.fromEntries(TENANT_FEATURES.map((feature) => [feature.key, true])),
};
const rollout = {
  httpMode: "rbac" as const,
  workerMode: "rbac" as const,
  epoch: BigInt(3),
  resolverVersion: TENANT_AUTHORIZATION_RESOLVER_VERSION,
  registryVersion: PERMISSION_REGISTRY_VERSION,
  operationMapVersion: OPERATION_MAP_VERSION,
  emergencyOverlay: null,
};

function grantClosure(keys: readonly string[]): readonly string[] {
  const grants = new Set(keys);
  const pending = [...keys];
  while (pending.length) {
    const permission = resolveActivePermission(pending.pop()!);
    for (const dependency of permission?.dependencies ?? []) {
      if (grants.has(dependency)) continue;
      grants.add(dependency);
      pending.push(dependency);
    }
  }
  return [...grants];
}

function account(lifecycle: TenantAuthorizationAccount["accountLifecycle"] = "active"): TenantAuthorizationAccount {
  return {
    userId: "actor",
    tenantId: "tenant-a",
    accountLifecycle: lifecycle,
    providerAdmin: false,
    applicant: false,
    activationComplete: true,
  };
}

function storeFor(
  actor: TenantAuthorizationAccount,
  authority: TenantAuthorizationAuthority,
  tenantOverrides: Partial<{
    operationalStatus: string | null;
    trialEndsAt: Date | null;
    settings: unknown;
  }> = {},
): TenantAuthorizationStore {
  return {
    async loadAccount() { return actor; },
    async loadTenantByDomain() {
      return {
        id: "tenant-a",
        domain: "a.example",
        npsn: "20100001",
        operationalStatus: "active",
        trialEndsAt: null,
        settings: enabledSettings,
        ...tenantOverrides,
      };
    },
    async loadAuthority() { return authority; },
    async loadRollout() { return rollout; },
  };
}

function requestFor(operation: TenantOperationDefinition) {
  const contextual = !["tenant-wide", "none", "school-admin-only"].includes(operation.contextualPolicy)
    ? {
        policy: operation.contextualPolicy,
        async evaluate() {
          const arm = operation.contextualArms.includes("assigned") ? "assigned" as const : "self" as const;
          return { allowed: true, arm };
        },
      }
    : undefined;
  return {
    sessionUserId: "actor",
    domain: "a.example",
    operationId: operation.id,
    surface: "api" as const,
    requestedPermissions: operation.permissionMode === "conditional" ? operation.requiredPermissions : undefined,
    context: contextual,
  };
}

for (const operation of generatedOperations) {
  test(`generated policy: School Admin resolves ${operation.id}`, async () => {
    const result = await createTenantAuthorizationEvaluator({
      store: storeFor(account(), {
        schoolAdminAuthorityStates: ["active"],
        assignments: [],
      }),
    }).evaluate(requestFor(operation));
    assert.equal(result.rbac.allowed, true, result.rbac.denial?.code);
    assert.equal(result.kind, "authorized");
  });

  test(`generated policy: exact custom grants and zero-role behavior for ${operation.id}`, async () => {
    const exactGrant: TenantAuthorizationAuthority = {
      schoolAdminAuthorityStates: [],
      assignments: [{
        assignmentId: "assignment",
        assignmentState: "active",
        roleId: "role",
        roleLifecycle: "active",
        permissionKeys: grantClosure(operation.requiredPermissions),
      }],
    };
    const granted = await createTenantAuthorizationEvaluator({
      store: storeFor(account(), exactGrant),
    }).evaluate(requestFor(operation));
    const schoolAdminOnly = operation.contextualPolicy === "school-admin-only" || operation.requiredPermissions.some((key) => key === "tenant.onboarding.complete");
    assert.equal(granted.rbac.allowed, !schoolAdminOnly, granted.rbac.denial?.code);

    const zeroRole = await createTenantAuthorizationEvaluator({
      store: storeFor(account(), { schoolAdminAuthorityStates: [], assignments: [] }),
    }).evaluate(requestFor(operation));
    assert.equal(zeroRole.rbac.allowed, false);
    assert.equal(zeroRole.rbac.denial?.code, "permission-denied");
  });
}

test("generated policy matrix includes every active Tenant RBAC operation", () => {
  assert.ok(generatedOperations.length > 0);
  assert.deepEqual(
    generatedOperations.map((operation) => operation.id),
    tenantOperationMap
      .filter((operation) => operation.classification === "tenant-rbac" && operation.lifecycle === "active")
      .map((operation) => operation.id),
  );
});

test("generated denial matrix covers inactive accounts, invalid grants, read-only state, entitlements, and wrong Tenant", async () => {
  const disabledSettings = {
    features: Object.fromEntries(TENANT_FEATURES.map((feature) => [feature.key, false])),
  };

  for (const operation of generatedOperations) {
    const request = requestFor(operation);
    const grants: TenantAuthorizationAuthority = {
      schoolAdminAuthorityStates: [],
      assignments: [{
        assignmentId: "assignment",
        assignmentState: "active",
        roleId: "role",
        roleLifecycle: "active",
        permissionKeys: grantClosure(operation.requiredPermissions),
      }],
    };

    const inactive = await createTenantAuthorizationEvaluator({
      store: storeFor(account("inactive"), grants),
    }).evaluate(request);
    assert.equal(inactive.rbac.denial?.code, "account-inactive", operation.id);

    for (const invalidAuthority of [
      { ...grants, assignments: grants.assignments.map((assignment) => ({ ...assignment, assignmentState: "suspended" })) },
      { ...grants, assignments: grants.assignments.map((assignment) => ({ ...assignment, roleLifecycle: "archived" })) },
    ]) {
      const invalidGrant = await createTenantAuthorizationEvaluator({
        store: storeFor(account(), invalidAuthority),
      }).evaluate(request);
      assert.equal(invalidGrant.rbac.denial?.code, "permission-denied", operation.id);
    }

    const wrongTenant = await createTenantAuthorizationEvaluator({
      store: storeFor({ ...account(), tenantId: "tenant-b" }, grants),
    }).evaluate(request);
    assert.equal(wrongTenant.rbac.denial?.code, "tenant-mismatch", operation.id);
    if (wrongTenant.kind === "denied") assert.equal(wrongTenant.external.kind, "not-found", operation.id);

    if (operation.operationalGate === "write") {
      const readOnly = await createTenantAuthorizationEvaluator({
        store: storeFor(account(), grants, { operationalStatus: "suspended" }),
      }).evaluate(request);
      assert.equal(readOnly.rbac.denial?.code, "read-only", operation.id);
    }

    if (operation.entitlement !== "none") {
      const disabled = await createTenantAuthorizationEvaluator({
        store: storeFor(account(), grants, { settings: disabledSettings }),
      }).evaluate(request);
      assert.equal(disabled.rbac.denial?.code, "entitlement-disabled", operation.id);
    }
  }
});

test("generated projection matrix requires every declared supplemental permission", async () => {
  for (const operation of generatedOperations.filter((candidate) => candidate.supplementalPermissions.length > 0 && candidate.permissionMode === "all")) {
    const permissions = operation.requiredPermissions.filter((key) => !operation.supplementalPermissions.includes(key));
    const result = await createTenantAuthorizationEvaluator({
      store: storeFor(account(), {
        schoolAdminAuthorityStates: [],
        assignments: [{
          assignmentId: "assignment",
          assignmentState: "active",
          roleId: "role",
          roleLifecycle: "active",
          permissionKeys: grantClosure(permissions),
        }],
      }),
    }).evaluate(requestFor(operation));
    assert.equal(result.rbac.allowed, false, operation.id);
    assert.equal(result.rbac.denial?.code, "permission-denied", operation.id);
  }
});

test("generated contextual matrix fails closed without proof and accepts every declared arm", async () => {
  for (const operation of generatedOperations.filter((candidate) =>
    ["assigned", "self", "assigned-or-self"].includes(candidate.contextualPolicy),
  )) {
    const store = storeFor(account(), {
      schoolAdminAuthorityStates: [],
      assignments: [{
        assignmentId: "assignment",
        assignmentState: "active",
        roleId: "role",
        roleLifecycle: "active",
        permissionKeys: grantClosure(operation.requiredPermissions),
      }],
    });
    const result = await createTenantAuthorizationEvaluator({ store }).evaluate({
      ...requestFor(operation),
      context: undefined,
    });
    assert.equal(result.rbac.allowed, false, operation.id);
    assert.equal(result.rbac.denial?.code, "scope-denied", operation.id);

    for (const arm of operation.contextualArms) {
      assert.ok(arm === "assigned" || arm === "self", operation.id);
      const armResult = await createTenantAuthorizationEvaluator({ store }).evaluate({
        ...requestFor(operation),
        context: {
          policy: operation.contextualPolicy,
          async evaluate() { return { allowed: true, arm }; },
        },
      });
      assert.equal(armResult.rbac.allowed, true, `${operation.id}:${arm}`);
    }
  }
});
