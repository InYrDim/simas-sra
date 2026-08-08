import assert from "node:assert/strict";
import test from "node:test";

import { validateCustomRolePermissions } from "@/lib/authorization/tenant-rbac-contract";
import {
  groupTenantAssignableRolePermissions,
  listTenantAssignableRolePermissions,
} from "@/lib/authorization/tenant-role-permission-catalog";

// VAL-ROLES-003 — the Create Role dialog must offer REAL registry keys that a
// tenant admin is allowed to assign, never the old hardcoded placeholders.

const PLACEHOLDER_KEYS = ["public.read", "class.read", "class.write", "grade.read", "grade.write"] as const;

test("catalog exposes only active tenant-assignable registry keys (no hardcoded placeholders)", () => {
  const options = listTenantAssignableRolePermissions();

  for (const placeholder of PLACEHOLDER_KEYS) {
    assert.equal(
      options.some((option) => option.key === placeholder),
      false,
      `placeholder ${placeholder} must not be offered`,
    );
  }

  const keys = new Set(options.map((option) => option.key));
  assert.ok(keys.has("tenant.dashboard.view"), "basic tenant dashboard key expected");
  assert.ok(keys.has("academic-years.years.view"), "M1 guru/siswa key expected");
  assert.ok(keys.has("absensi.attendance.view"), "absensi key expected");
  // school-admin-only keys must NOT be assignable by a tenant admin.
  assert.equal(keys.has("tenant.roles.list"), false, "school-admin-only key must not be offered");
  assert.equal(keys.has("tenant.authorization-audit.view"), false, "school-admin-only key must not be offered");
});

test("every offered permission passes validateCustomRolePermissions when selected together", () => {
  const result = validateCustomRolePermissions(
    listTenantAssignableRolePermissions().map((option) => option.key),
  );
  assert.ok(result.ok, `expected ok, got ${JSON.stringify(result)}`);
});

test("every dependency of an offered permission is itself offered (dependency closure)", () => {
  const byKey = new Map(
    listTenantAssignableRolePermissions().map((option) => [option.key, option]),
  );
  for (const option of listTenantAssignableRolePermissions()) {
    for (const dependency of option.dependencies) {
      assert.ok(byKey.has(dependency), `${option.key} depends on ${dependency} which is not offered`);
    }
  }
});

test("a leaf key with no dependencies is individually selectable", () => {
  const options = listTenantAssignableRolePermissions();
  const leaf = options.find((option) => option.dependencies.length === 0);
  assert.ok(leaf, "expected at least one dependency-free assignable permission");
  const result = validateCustomRolePermissions([leaf!.key]);
  assert.ok(result.ok, `expected ok for ${leaf!.key}, got ${JSON.stringify(result)}`);
});

test("a dependent key requires its dependencies in the selection (mirrors role lifecycle validation)", () => {
  const options = listTenantAssignableRolePermissions();
  const dependent = options.find((option) => option.dependencies.length > 0);
  assert.ok(dependent, "expected at least one assignable permission with dependencies");
  assert.ok(!validateCustomRolePermissions([dependent!.key]).ok, "missing dependency must fail");
  const closed = [dependent!.key, ...dependent!.dependencies];
  assert.ok(validateCustomRolePermissions(closed).ok, "dependency-closed selection must pass");
});

test("catalog exposes readable module grouping and stable metadata for the dialog", () => {
  const groups = groupTenantAssignableRolePermissions();
  assert.ok(groups.length > 0, "expected at least one group");
  for (const group of groups) {
    assert.ok(group.label.length > 0, "group label is missing");
    assert.ok(group.permissions.length > 0, `group ${group.label} has no permissions`);
    for (const option of group.permissions) {
      assert.ok(option.label.trim().length > 0, `label missing for ${option.key}`);
      assert.ok(option.key.split(".").length === 3, `malformed key ${option.key}`);
    }
  }
});
