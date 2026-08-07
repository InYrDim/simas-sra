import { test } from "node:test";
import assert from "node:assert/strict";

import {
  ABSENSI_KEY_PREFIX,
  GURU_ROLE_PERMISSIONS,
  SISWA_ROLE_PERMISSIONS,
  validateRolePermissionSet,
  validateSdn191RolePermissionPlan,
  validateStudentExclusions,
  validateRoleSetsDistinct,
} from "./sdn191-rbac-permissions";
import { resolveActivePermission } from "@/lib/authorization/tenant-rbac-contract";

test("every guru permission key is registered, active, and tenant-assignable (M2)", () => {
  const issues = validateRolePermissionSet(GURU_ROLE_PERMISSIONS);
  assert.deepEqual(issues, []);
  for (const key of GURU_ROLE_PERMISSIONS) {
    const entry = resolveActivePermission(key);
    assert.ok(entry, `guru key missing from registry: ${key}`);
    assert.equal(entry.assignment, "tenant-assignable", `guru key not assignable: ${key}`);
  }
});

test("every siswa permission key is registered, active, and tenant-assignable", () => {
  const issues = validateRolePermissionSet(SISWA_ROLE_PERMISSIONS);
  assert.deepEqual(issues, []);
  for (const key of SISWA_ROLE_PERMISSIONS) {
    const entry = resolveActivePermission(key);
    assert.ok(entry, `siswa key missing from registry: ${key}`);
    assert.equal(entry.assignment, "tenant-assignable", `siswa key not assignable: ${key}`);
  }
});

test("siswa has no admin-only key and no absensi.* key in M2", () => {
  const issues = validateStudentExclusions(SISWA_ROLE_PERMISSIONS);
  assert.deepEqual(issues, []);
  for (const key of SISWA_ROLE_PERMISSIONS) {
    assert.ok(!key.startsWith(ABSENSI_KEY_PREFIX), `siswa must not get absensi: ${key}`);
  }
});

test("M2 guru role includes absensi.attendance.view while siswa keeps it out and no admin module leaks into non-admin roles", () => {
  assert.ok(GURU_ROLE_PERMISSIONS.includes("absensi.attendance.view"), "guru must hold absensi.attendance.view in M2");
  const present = new Set([...GURU_ROLE_PERMISSIONS, ...SISWA_ROLE_PERMISSIONS]);
  for (const key of present) {
    const entry = resolveActivePermission(key);
    assert.equal(entry?.assignment, "tenant-assignable", `non-assignable key leaked: ${key}`);
  }
  for (const key of SISWA_ROLE_PERMISSIONS) {
    assert.ok(!key.startsWith(ABSENSI_KEY_PREFIX), `siswa absensi key leaked: ${key}`);
  }
});

test("guru and siswa permission sets differ", () => {
  const issues = validateRoleSetsDistinct(GURU_ROLE_PERMISSIONS, SISWA_ROLE_PERMISSIONS);
  assert.deepEqual(issues, []);
});

test("full role-permission plan validates with no issues", () => {
  const issues = validateSdn191RolePermissionPlan();
  assert.deepEqual(issues, []);
});

test("negatives: an unknown key is rejected", () => {
  const issues = validateRolePermissionSet(["tenant.dashboard.view", "module.resource.unknown-key"]);
  assert.ok(issues.some((issue) => issue.key === "module.resource.unknown-key" && issue.code === "unknown-key"));
});

test("negatives: a school-admin-only key is rejected for a student role", () => {
  const issues = validateStudentExclusions(["tenant.roles.list"]);
  assert.ok(issues.some((i) => i.key === "tenant.roles.list" && i.code === "school-admin-only"));
});

test("negatives: identical role sets are flagged", () => {
  const issues = validateRoleSetsDistinct(["tenant.dashboard.view"], ["tenant.dashboard.view"]);
  assert.ok(issues.some((i) => i.code === "role-sets-identical"));
});
