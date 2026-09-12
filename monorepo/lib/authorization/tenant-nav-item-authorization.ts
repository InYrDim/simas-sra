import type { TenantNavItem } from "@/types/components/TenantNavItem";

/**
 * Pure authorization predicate shared by the client sidebar and server-side
 * helpers (guards, homepage fallback).
 *
 * This module is deliberately plain (no `"use client"`): Server Components that
 * import it must not cross the RSC boundary. Client components (e.g. the tenant
 * nav menu) re-export the predicate from here and keep working unchanged.
 */
export function isNavigationItemAuthorized(
  item: Pick<TenantNavItem, "requiredPermissions" | "permissionMode">,
  permissions: ReadonlySet<string>,
) {
  if (!item.requiredPermissions?.length) return permissions.size > 0
  if (item.permissionMode === "any") return item.requiredPermissions.some((permission) => permissions.has(permission))
  return item.requiredPermissions.every((permission) => permissions.has(permission))
}
