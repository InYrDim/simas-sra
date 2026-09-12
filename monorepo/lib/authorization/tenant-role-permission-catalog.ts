import { permissionRegistry } from "@/lib/authorization/tenant-rbac-contract";

/**
 * Catalog of permissions a tenant (school) admin may assign to a custom role,
 * derived from the executable permission registry.
 *
 * The selection criteria mirror the role lifecycle validation in
 * `tenant-role-lifecycle.ts` `validatePermissions`: a key must exist in the
 * registry, be tenant-assignable (never school-admin-only / system-internal),
 * and its dependency closure must be satisfiable within the assignable set.
 * Additionally only `active` keys are offered (deprecated/reserved keys are
 * never surfaced in the picker, keeping `validateCustomRolePermissions` green
 * for any single-row selection with its dependencies).
 *
 * This module is intentionally plain (no `"use client"`): it is consumed by the
 * Server Component roles page and must never cross into client bundles.
 */

export type TenantAssignableRolePermission = Readonly<{
  key: string;
  label: string;
  description: string;
  group: string;
  dependencies: readonly string[];
}>;

export type TenantAssignableRolePermissionGroup = Readonly<{
  label: string;
  permissions: readonly TenantAssignableRolePermission[];
}>;

export function listTenantAssignableRolePermissions(): TenantAssignableRolePermission[] {
  return permissionRegistry
    .filter((entry) => entry.lifecycle === "active" && entry.assignment === "tenant-assignable")
    .map((entry) => ({
      key: entry.key,
      label: entry.labelId,
      description: entry.descriptionId,
      group: entry.groupId,
      dependencies: [...entry.dependencies],
    }));
}

/** Permission catalog grouped by the registry's module group, in registry order. */
export function groupTenantAssignableRolePermissions(): TenantAssignableRolePermissionGroup[] {
  const grouped = new Map<string, TenantAssignableRolePermission[]>();
  for (const option of listTenantAssignableRolePermissions()) {
    const existing = grouped.get(option.group) ?? [];
    existing.push(option);
    grouped.set(option.group, existing);
  }
  return Array.from(grouped.entries(), ([label, permissions]) => ({ label, permissions }));
}
