// Pure helpers describing the RBAC permission sets provisioned for tenant SDN 191.
//
// Milestone 1 constraint: guru & siswa only receive permission keys that already
// exist in the registry (dashboard + akademik read). Key `absensi.*` is added in
// Milestone 2 together with its registry entries (see VAL-DATA-008 / VAL-DATA-017),
// so M1 provisioning intentionally does NOT include any `absensi.*` key.
//
// These functions have no I/O so they can be unit-tested in isolation.

import { resolveActivePermission } from "@/lib/authorization/tenant-rbac-contract";

export const ABSENSI_KEY_PREFIX = "absensi.";

/** Permission set assigned to the `guru` (teacher) role of tenant SDN 191. */
export const GURU_ROLE_PERMISSIONS: readonly string[] = [
  "tenant.dashboard.view",
  "academic-years.years.view",
  "subjects.subjects.view",
  "class-groups.groups.view",
  "students.students.view",
  "teachers.teachers.view",
];

/** Permission set assigned to the `siswa` (student) role of tenant SDN 191. */
export const SISWA_ROLE_PERMISSIONS: readonly string[] = [
  "tenant.dashboard.view",
  "academic-years.years.view",
  "subjects.subjects.view",
  "class-groups.groups.view",
];

export type RolePermissionIssue = Readonly<{
  key: string;
  code:
    | "unknown-key"
    | "school-admin-only"
    | "absensi-before-m2"
    | "dependency-not-included"
    | "role-sets-identical";
  detail?: string;
}>;

function resolveDefinition(key: string) {
  return resolveActivePermission(key);
}

/**
 * Validate that a custom role's permission set is safe to provision at M1:
 * - every key is registered & active (`resolveActivePermission`);
 * - every key is tenant-assignable (custom roles must NOT embed school-admin-only
 *   or system-internal keys);
 * - dependencies of every key are also present inside the role;
 * - no M2-only `absensi.*` key leaks in.
 */
export function validateRolePermissionSet(keys: readonly string[]): RolePermissionIssue[] {
  const issues: RolePermissionIssue[] = [];
  const present = new Set(keys);
  for (const key of keys) {
    const entry = resolveDefinition(key);
    if (!entry) {
      issues.push({ key, code: "unknown-key" });
      continue;
    }
    if (key.startsWith(ABSENSI_KEY_PREFIX)) {
      issues.push({ key, code: "absensi-before-m2" });
    }
    if (entry.assignment !== "tenant-assignable") {
      issues.push({ key, code: "school-admin-only" });
    }
    for (const dep of entry.dependencies) {
      if (!present.has(dep)) issues.push({ key, code: "dependency-not-included", detail: dep });
    }
  }
  return issues;
}

/**
 * Students must never receive a school-admin-only key nor any `absensi.*` key at M1
 * (VAL-DATA-008). Detects both cases.
 */
export function validateStudentExclusions(siswaKeys: readonly string[]): RolePermissionIssue[] {
  const issues: RolePermissionIssue[] = [];
  for (const key of siswaKeys) {
    if (key.startsWith(ABSENSI_KEY_PREFIX)) {
      issues.push({ key, code: "absensi-before-m2" });
    }
    const entry = resolveDefinition(key);
    if (entry && entry.assignment !== "tenant-assignable") {
      issues.push({ key, code: "school-admin-only" });
    }
  }
  return issues;
}

/** Guru and siswa sets must differ (VAL-DATA-008). */
export function validateRoleSetsDistinct(...sets: (readonly string[])[]): RolePermissionIssue[] {
  for (let i = 0; i < sets.length - 1; i += 1) {
    for (let j = i + 1; j < sets.length; j += 1) {
      const a = new Set(sets[i]);
      const b = new Set(sets[j]);
      const identical = a.size === b.size && [...a].every((key) => b.has(key));
      if (identical) return [{ key: "role-sets", code: "role-sets-identical" }];
    }
  }
  return [];
}

/** Run the full M1 role-permission plan validation used by unit tests. */
export function validateSdn191RolePermissionPlan(): RolePermissionIssue[] {
  return [
    ...validateRolePermissionSet(GURU_ROLE_PERMISSIONS),
    ...validateRolePermissionSet(SISWA_ROLE_PERMISSIONS),
    ...validateStudentExclusions(SISWA_ROLE_PERMISSIONS),
    ...validateRoleSetsDistinct(GURU_ROLE_PERMISSIONS, SISWA_ROLE_PERMISSIONS),
  ];
}
