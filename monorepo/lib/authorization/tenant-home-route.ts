import { isNavigationItemAuthorized } from "@/lib/authorization/tenant-nav-item-authorization";
import type { TenantNavItem } from "@/types/components/TenantNavItem";

export const TENANT_HOME_DASHBOARD = "/dashboard";
export const TENANT_DASHBOARD_PERMISSION = "tenant.dashboard.view";

export type TenantHomeRouteDecision =
  | { kind: "dashboard"; path: typeof TENANT_HOME_DASHBOARD }
  | { kind: "redirect"; path: string }
  | { kind: "no-access" };

/**
 * Resolve the tenant homepage for a principal based on its effective
 * permissions and the tenant navigation menu:
 *
 * - Holds `tenant.dashboard.view` -> keep `/dashboard` (default for every role).
 * - No dashboard access but at least one allowed page -> redirect to the first
 *   menu page (config order) that passes `isNavigationItemAuthorized`.
 * - No permission / no authorized page -> `no-access` so the caller can render
 *   a clear "NoTenantAccess" state instead of a 403 or a redirect loop.
 *
 * The helper is pure (no `next/navigation`, no React) so it can be unit-tested
 * without a server; callers decide how to turn `redirect`/`no-access` into a
 * response.
 */
export function resolveTenantHomeRoute(
  permissions: ReadonlySet<string>,
  menuItems: readonly TenantNavItem[],
): TenantHomeRouteDecision {
  if (permissions.has(TENANT_DASHBOARD_PERMISSION)) {
    return { kind: "dashboard", path: TENANT_HOME_DASHBOARD };
  }
  const firstAllowedPath = findFirstAuthorizedPagePath(menuItems, permissions);
  if (firstAllowedPath) return { kind: "redirect", path: firstAllowedPath };
  return { kind: "no-access" };
}

function findFirstAuthorizedPagePath(
  items: readonly TenantNavItem[],
  permissions: ReadonlySet<string>,
): string | null {
  for (const item of items) {
    if (item.items?.length) {
      const childPath = findFirstAuthorizedPagePath(item.items, permissions);
      if (childPath) return childPath;
      continue;
    }
    if (item.url && isNavigationItemAuthorized(item, permissions)) return item.url;
  }
  return null;
}
