import { isNavigationItemAuthorized } from "@/lib/authorization/tenant-nav-item-authorization";
import type { TenantFeatureSelection } from "@/lib/features/tenant-feature-policy";
import type { TenantMenuVisibility } from "@/lib/features/tenant-menu-visibility";
import type { TenantNavItem } from "@/types/components/TenantNavItem";

export const TENANT_HOME_DASHBOARD = "/dashboard";
export const TENANT_DASHBOARD_PERMISSION = "tenant.dashboard.view";

export type TenantHomeRouteDecision =
  | { kind: "dashboard"; path: typeof TENANT_HOME_DASHBOARD }
  | { kind: "redirect"; path: string }
  | { kind: "no-access" };

/**
 * Context every homepage fallback needs beyond the principal's permissions:
 * the tenant's effective (dependency-resolved) feature selection and whether
 * onboarding has completed. Both are required so a caller cannot accidentally
 * apply the fallback without the provider feature gate or the onboarding lock.
 */
export type TenantHomeRouteContext = {
  /** Effective (provider-dependency-resolved) feature selection for the tenant. */
  features: TenantFeatureSelection;
  /** Whether the tenant has completed onboarding (`onboardingCompletedAt != null`). */
  onboardingCompleted: boolean;
  /** Per-Tenant sidebar visibility; hidden items are never a redirect target. */
  menuVisibility?: TenantMenuVisibility;
};

/**
 * Resolve the tenant homepage for a principal based on its effective
 * permissions, the tenant navigation menu, and the tenant's provider state:
 *
 * - Onboarding incomplete -> keep `/dashboard` unconditionally. The
 *   authenticated layout redirects every path other than `/dashboard` back to
 *   `/dashboard` until onboarding completes, so any fallback redirect here
 *   would bounce between `/dashboard` and the target forever.
 * - Holds `tenant.dashboard.view` -> keep `/dashboard` (default for every role).
 * - No dashboard access but at least one allowed page -> redirect to the first
 *   menu page (config order) that passes `isNavigationItemAuthorized` AND whose
 *   Provider feature gate is active (mirrors the sidebar's `disabled` logic for
 *   `item.feature`), so a principal is never sent to a provider-disabled page.
 * - No permission / no authorized page -> `no-access` so the caller can render
 *   a clear "NoTenantAccess" state instead of a 403 or a redirect loop.
 *
 * The helper is pure (no `next/navigation`, no React, no database) so it can be
 * unit-tested without a server; callers decide how to turn
 * `redirect`/`no-access` into a response. It lives in a plain module (no
 * `"use client"`) so Server Components can import it across the RSC boundary.
 */
export function resolveTenantHomeRoute(
  permissions: ReadonlySet<string>,
  menuItems: readonly TenantNavItem[],
  ctx: TenantHomeRouteContext,
): TenantHomeRouteDecision {
  if (!ctx.onboardingCompleted) {
    return { kind: "dashboard", path: TENANT_HOME_DASHBOARD };
  }
  if (permissions.has(TENANT_DASHBOARD_PERMISSION)) {
    return { kind: "dashboard", path: TENANT_HOME_DASHBOARD };
  }
  const firstAllowedPath = findFirstAuthorizedPagePath(menuItems, permissions, ctx.features, ctx.menuVisibility);
  if (firstAllowedPath) return { kind: "redirect", path: firstAllowedPath };
  return { kind: "no-access" };
}

function findFirstAuthorizedPagePath(
  items: readonly TenantNavItem[],
  permissions: ReadonlySet<string>,
  features: TenantFeatureSelection,
  menuVisibility?: TenantMenuVisibility,
): string | null {
  for (const item of items) {
    // A Provider-hidden menu item is never a redirect target.
    if (menuVisibility && menuVisibility[item.key] === false) continue;
    // Mirror the sidebar's disabled logic (`item.feature && !features[item.feature]`):
    // a provider-disabled item — leaf or whole collapsible group — can never be a
    // redirect target, because the sidebar renders no reachable link for it.
    if (item.feature && !features[item.feature]) continue;
    if (item.items?.length) {
      const childPath = findFirstAuthorizedPagePath(item.items, permissions, features, menuVisibility);
      if (childPath) return childPath;
      continue;
    }
    if (item.url && isNavigationItemAuthorized(item, permissions)) return item.url;
  }
  return null;
}
