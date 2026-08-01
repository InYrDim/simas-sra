import assert from "node:assert/strict";
import test from "node:test";

import {
  LEGACY_NON_ADMIN_ROLES,
  OPERATION_MAP_VERSION,
  PERMISSION_REGISTRY_VERSION,
  permissionRegistry,
  permissionRegistryDigest,
  resolveActivePermission,
  resolveLegacyPermissionKeys,
  tenantOperationMap,
  tenantOperationMapDigest,
  validateCustomRolePermissions,
  validatePermissionRegistry,
  validateTenantRbacContract,
  type PermissionDefinition,
} from "@/lib/authorization/tenant-rbac-contract";

const legacyMinimum = [
  "tenant.dashboard.view",
  "tenant.users.view",
  "tenant.users.view-contact",
  "tenant.users.view-sensitive",
];

test("the approved registry and operation map form a valid executable contract", () => {
  assert.equal(PERMISSION_REGISTRY_VERSION, "tenant-permissions@2");
  assert.equal(OPERATION_MAP_VERSION, "tenant-operations@2");
  assert.equal(permissionRegistry.length, 148);
  assert.match(permissionRegistryDigest, /^[a-f0-9]{64}$/);
  assert.match(tenantOperationMapDigest, /^[a-f0-9]{64}$/);
  assert.deepEqual(validateTenantRbacContract(), []);
});

test("every permission exposes stable Indonesian catalog metadata", () => {
  for (const permission of permissionRegistry) {
    assert.equal(permission.key, `${permission.module}.${permission.resource}.${permission.action}`);
    assert.ok(permission.labelId.trim().length > 0, permission.key);
    assert.ok(permission.descriptionId.trim().length > 0, permission.key);
    assert.ok(permission.groupId.trim().length > 0, permission.key);
    assert.ok(Number.isSafeInteger(permission.order), permission.key);
    assert.ok(Array.isArray(permission.dependencies), permission.key);
    assert.ok(Array.isArray(permission.replacements), permission.key);
  }
});

test("role and assignment administration permissions are active but remain non-assignable", () => {
  assert.equal(resolveActivePermission("tenant.dashboard.view")?.key, "tenant.dashboard.view");
  assert.equal(resolveActivePermission("tenant.roles.change-permissions")?.key, "tenant.roles.change-permissions");
  assert.equal(resolveActivePermission("unknown.resource.view"), null);

  const privileged = permissionRegistry.find((entry) => entry.key === "tenant.roles.change-permissions");
  assert.equal(privileged?.lifecycle, "active");
  assert.equal(privileged?.assignment, "school-admin-only");

  assert.deepEqual(validateCustomRolePermissions(["tenant.roles.change-permissions"]), {
    ok: false,
    issues: [{ code: "permission-not-assignable", key: "tenant.roles.change-permissions" }],
  });
  assert.deepEqual(validateCustomRolePermissions(["unknown.resource.view"]), {
    ok: false,
    issues: [{ code: "unknown-permission", key: "unknown.resource.view" }],
  });
});

test("custom roles reject privileged keys and incomplete dependency selections", () => {
  assert.deepEqual(validateCustomRolePermissions(["tenant.onboarding.complete"]), {
    ok: false,
    issues: [{ code: "permission-not-assignable", key: "tenant.onboarding.complete" }],
  });
  assert.deepEqual(validateCustomRolePermissions(["tenant.users.view-sensitive"]), {
    ok: false,
    issues: [{ code: "missing-dependency", key: "tenant.users.view-sensitive", dependency: "tenant.users.view" }],
  });
  assert.deepEqual(validateCustomRolePermissions(["tenant.users.view", "tenant.users.view-sensitive"]), {
    ok: true,
    permissions: ["tenant.users.view", "tenant.users.view-sensitive"],
  });
});

test("registry validation rejects malformed keys, duplicates, cycles, and invalid deprecation", () => {
  const base: PermissionDefinition = {
    key: "tenant.widgets.view",
    module: "tenant",
    resource: "widgets",
    action: "view",
    labelId: "Lihat widget",
    descriptionId: "Melihat widget Tenant.",
    groupId: "Pengguna & Keamanan",
    order: 1,
    dependencies: [],
    risk: "low",
    assignment: "tenant-assignable",
    lifecycle: "active",
    replacements: [],
  };

  const malformed = { ...base, key: "Tenant.widgets.view" };
  const deprecated = { ...base, key: "tenant.widgets.old", action: "old", lifecycle: "deprecated" as const };
  const first = { ...base, dependencies: ["tenant.gadgets.view"] };
  const second = {
    ...base,
    key: "tenant.gadgets.view",
    resource: "gadgets",
    dependencies: ["tenant.widgets.view"],
  };
  const issues = validatePermissionRegistry([base, base, malformed, deprecated, first, second]);
  assert.ok(issues.some((issue) => issue.code === "duplicate-key"));
  assert.ok(issues.some((issue) => issue.code === "malformed-key"));
  assert.ok(issues.some((issue) => issue.code === "deprecated-without-replacement"));
  assert.ok(issues.some((issue) => issue.code === "dependency-cycle"));
});

test("legacy non-admin equivalence grants exactly L0 and unknown roles fail closed", () => {
  assert.deepEqual(LEGACY_NON_ADMIN_ROLES, ["pimpinan", "staff", "guru", "siswa", "guest"]);
  for (const role of LEGACY_NON_ADMIN_ROLES) {
    assert.deepEqual(resolveLegacyPermissionKeys(role), legacyMinimum, role);
  }
  assert.deepEqual(resolveLegacyPermissionKeys("school-admin"), []);
  assert.deepEqual(resolveLegacyPermissionKeys("future-role"), []);

  const currentKeys = tenantOperationMap
    .filter((operation) => operation.lifecycle === "active")
    .flatMap((operation) => operation.requiredPermissions);
  for (const key of currentKeys) {
    if (!legacyMinimum.includes(key)) {
      assert.equal(resolveLegacyPermissionKeys("guru").includes(key), false, key);
    }
  }
});

test("digests are deterministic and bind versions to canonical content", async () => {
  const first = await import("@/lib/authorization/tenant-rbac-contract");
  const second = await import("@/lib/authorization/tenant-rbac-contract");
  assert.equal(first.permissionRegistryDigest, second.permissionRegistryDigest);
  assert.equal(first.tenantOperationMapDigest, second.tenantOperationMapDigest);
  assert.notEqual(permissionRegistryDigest, tenantOperationMapDigest);
});
