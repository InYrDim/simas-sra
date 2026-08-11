import assert from "node:assert/strict";
import test from "node:test";

import { TENANT_FEATURES } from "@/config/tenant-features";
import { tenantMenuItems } from "@/components/tenant-nav-menu/config";
import { isNavigationItemAuthorized } from "@/lib/authorization/tenant-nav-item-authorization";
import {
  resolveTenantHomeRoute,
  type TenantHomeRouteContext,
} from "@/lib/authorization/tenant-home-route";
import type { TenantFeatureSelection } from "@/lib/features/tenant-feature-policy";
import type { TenantMenuVisibility } from "@/lib/features/tenant-menu-visibility";
import type { TenantNavItem } from "@/types/components/TenantNavItem";

/** Feature selection with every registry feature enabled (mirror of a fully-provided tenant). */
function featuresWith(overrides: Partial<TenantFeatureSelection>): TenantFeatureSelection {
  return {
    ...(Object.fromEntries(TENANT_FEATURES.map(({ key }) => [key, true])) as TenantFeatureSelection),
    ...overrides,
  };
}

/** Home-route context for a tenant that has completed onboarding. */
function completed(
  featureOverrides: Partial<TenantFeatureSelection> = {},
  menuVisibility?: TenantMenuVisibility,
): TenantHomeRouteContext {
  return { features: featuresWith(featureOverrides), onboardingCompleted: true, menuVisibility };
}

/** Home-route context for a tenant whose onboarding is still incomplete. */
function onboardingLocked(
  featureOverrides: Partial<TenantFeatureSelection> = {},
  menuVisibility?: TenantMenuVisibility,
): TenantHomeRouteContext {
  return { features: featuresWith(featureOverrides), onboardingCompleted: false, menuVisibility };
}

test("keeps /dashboard as the home route when the principal holds tenant.dashboard.view", () => {
  assert.deepEqual(resolveTenantHomeRoute(new Set(["tenant.dashboard.view"]), tenantMenuItems, completed()), {
    kind: "dashboard",
    path: "/dashboard",
  });
  assert.deepEqual(
    resolveTenantHomeRoute(new Set(["tenant.dashboard.view", "absensi.attendance.view"]), tenantMenuItems, completed()),
    { kind: "dashboard", path: "/dashboard" },
  );
});

test("redirects to the first authorized menu page when dashboard access is missing", () => {
  assert.deepEqual(resolveTenantHomeRoute(new Set(["absensi.attendance.view"]), tenantMenuItems, completed()), {
    kind: "redirect",
    path: "/absensi",
  });
  assert.deepEqual(resolveTenantHomeRoute(new Set(["tenant.authorization-audit.view"]), tenantMenuItems, completed()), {
    kind: "redirect",
    path: "/e-library",
  });
  assert.deepEqual(resolveTenantHomeRoute(new Set(["quizzes.sessions.view"]), tenantMenuItems, completed()), {
    kind: "redirect",
    path: "/ulangan",
  });
  assert.deepEqual(resolveTenantHomeRoute(new Set(["tenant.users.view"]), tenantMenuItems, completed()), {
    kind: "redirect",
    path: "/users",
  });
});

test("walks nested menu groups in config order to find the first allowed page", () => {
  assert.deepEqual(resolveTenantHomeRoute(new Set(["ppdb.submissions.view"]), tenantMenuItems, completed()), {
    kind: "redirect",
    path: "/ppdb",
  });
  assert.deepEqual(resolveTenantHomeRoute(new Set(["school-profile.profile.view"]), tenantMenuItems, completed()), {
    kind: "redirect",
    path: "/master",
  });
});

test("returns no-access for a principal without any permission", () => {
  assert.deepEqual(resolveTenantHomeRoute(new Set(), tenantMenuItems, completed()), { kind: "no-access" });
});

test("returns no-access when permissions authorize no menu page", () => {
  assert.deepEqual(
    resolveTenantHomeRoute(new Set(["tenant.onboarding.complete"]), tenantMenuItems, completed()),
    { kind: "no-access" },
  );
});

test("redirect target is never /dashboard (no home loop)", () => {
  const permissionSets = [
    ["absensi.attendance.view"],
    ["tenant.authorization-audit.view"],
    ["ppdb.submissions.view"],
    ["quizzes.sessions.view"],
    ["tenant.users.view"],
    ["school-profile.profile.view"],
  ];
  for (const keys of permissionSets) {
    const decision = resolveTenantHomeRoute(new Set(keys), tenantMenuItems, completed());
    if (decision.kind === "redirect") assert.notEqual(decision.path, "/dashboard");
  }
});

test("redirect target is always an authorized menu item (consistent with sidebar filter)", () => {
  const cases: readonly (readonly string[])[] = [
    ["absensi.attendance.view"],
    ["tenant.authorization-audit.view"],
    ["ppdb.submissions.view"],
    ["quizzes.sessions.view"],
    ["tenant.users.view"],
    ["school-profile.profile.view"],
  ];
  for (const keys of cases) {
    const decision = resolveTenantHomeRoute(new Set(keys), tenantMenuItems, completed());
    if (decision.kind !== "redirect") continue;
    const allItems = tenantMenuItems.flatMap((item) => item.items ?? [item]);
    const target = allItems.find((item) => item.url === decision.path);
    assert.ok(target, `no menu item with url ${decision.path}`);
    assert.equal(isNavigationItemAuthorized(target, new Set(keys)), true, decision.path);
  }
});

test("skips menu pages behind a provider-disabled feature when looking for the first allowed page", () => {
  // Only page is PPDB, whose ppdbRead feature the Provider disabled -> no-access,
  // never a redirect onto a non-active page.
  assert.deepEqual(
    resolveTenantHomeRoute(new Set(["ppdb.submissions.view"]), tenantMenuItems, completed({ ppdbRead: false })),
    { kind: "no-access" },
  );
  // Ulangan group gated by ulanganRead, Master Data by masterDataRead: identical to mirror.
  assert.deepEqual(
    resolveTenantHomeRoute(new Set(["quizzes.sessions.view"]), tenantMenuItems, completed({ ulanganRead: false })),
    { kind: "no-access" },
  );
  assert.deepEqual(
    resolveTenantHomeRoute(
      new Set(["school-profile.profile.view", "people-imports.revisions.view"]),
      tenantMenuItems,
      completed({ masterDataRead: false }),
    ),
    { kind: "no-access" },
  );
});

test("feature-disabled items are skipped in favor of the next allowed page (config order)", () => {
  const permissions = new Set(["ppdb.submissions.view", "tenant.users.view"]);
  // With ppdbRead enabled, /ppdb (config first) wins.
  assert.deepEqual(resolveTenantHomeRoute(permissions, tenantMenuItems, completed()), {
    kind: "redirect",
    path: "/ppdb",
  });
  // With ppdbRead disabled, PPDB (with its nested urls) is skipped and /users wins.
  assert.deepEqual(
    resolveTenantHomeRoute(permissions, tenantMenuItems, completed({ ppdbRead: false })),
    { kind: "redirect", path: "/users" },
  );
});

test("a collapsible group behind a disabled feature is skipped entirely", () => {
  // PPDB group holds both child permissions; with ppdbRead disabled the whole
  // group must be ignored (sidebar shows a disabled button, no reachable page).
  const permissions = new Set(["ppdb.submissions.view", "ppdb.sessions.view"]);
  assert.deepEqual(
    resolveTenantHomeRoute(permissions, tenantMenuItems, completed({ ppdbRead: false })),
    { kind: "no-access" },
  );
});

test("onboarding-incomplete locks the home route to /dashboard (no fallback redirect loop)", () => {
  // Layout redirects every path != /dashboard back to /dashboard while onboarding
  // is incomplete; the fallback must never redirect away from /dashboard.
  assert.deepEqual(
    resolveTenantHomeRoute(new Set(["absensi.attendance.view"]), tenantMenuItems, onboardingLocked()),
    { kind: "dashboard", path: "/dashboard" },
  );
  assert.deepEqual(
    resolveTenantHomeRoute(new Set(), tenantMenuItems, onboardingLocked()),
    { kind: "dashboard", path: "/dashboard" },
  );
  assert.deepEqual(
    resolveTenantHomeRoute(new Set(["tenant.dashboard.view"]), tenantMenuItems, onboardingLocked()),
    { kind: "dashboard", path: "/dashboard" },
  );
});

test("onboarding-incomplete wins even when the only allowed page is behind a disabled feature", () => {
  // The dashboard-only guard runs BEFORE the permission-aware fallback, so an
  // onboarding-incomplete tenant always stays on /dashboard even for a principal
  // whose only menu page is behind a provider-disabled feature.
  const permissions = new Set(["ppdb.submissions.view"]);
  assert.deepEqual(
    resolveTenantHomeRoute(permissions, tenantMenuItems, onboardingLocked({ ppdbRead: false })),
    { kind: "dashboard", path: "/dashboard" },
  );
});

test("respects config ordering on a synthetic menu", () => {
  const menu: TenantNavItem[] = [
    { key: "home", title: "Home", url: "/dashboard", requiredPermissions: ["tenant.dashboard.view"] },
    { key: "first", title: "First", url: "/first", requiredPermissions: ["first.view"] },
    {
      key: "group",
      title: "Group",
      items: [
        { key: "nested-a", title: "Nested A", url: "/nested-a", requiredPermissions: ["nested-a.view"] },
        { key: "nested-b", title: "Nested B", url: "/nested-b", requiredPermissions: ["nested-b.view"] },
      ],
    },
  ];
  assert.deepEqual(resolveTenantHomeRoute(new Set(["first.view"]), menu, completed()), {
    kind: "redirect",
    path: "/first",
  });
  assert.deepEqual(resolveTenantHomeRoute(new Set(["nested-b.view"]), menu, completed()), {
    kind: "redirect",
    path: "/nested-b",
  });
  assert.deepEqual(resolveTenantHomeRoute(new Set(["other.view"]), menu, completed()), { kind: "no-access" });
});

test("synthetic menu: a disabled feature item is skipped while a later active item still wins", () => {
  const menu: TenantNavItem[] = [
    { key: "gated-first", title: "Gated First", url: "/gated", requiredPermissions: ["gated.view"], feature: "ppdbRead" },
    { key: "second", title: "Second", url: "/second", requiredPermissions: ["second.view"] },
  ];
  const permissions = new Set(["gated.view", "second.view"]);
  assert.deepEqual(resolveTenantHomeRoute(permissions, menu, completed({ ppdbRead: false })), {
    kind: "redirect",
    path: "/second",
  });
  assert.deepEqual(resolveTenantHomeRoute(permissions, menu, completed()), {
    kind: "redirect",
    path: "/gated",
  });
});

test("hidden menu items are skipped when resolving the first allowed page", () => {
  const menu: TenantNavItem[] = [
    { key: "first", title: "First", url: "/first", requiredPermissions: ["first.view"] },
    { key: "second", title: "Second", url: "/second", requiredPermissions: ["second.view"] },
    {
      key: "group",
      title: "Group",
      items: [
        { key: "nested-a", title: "Nested A", url: "/nested-a", requiredPermissions: ["nested-a.view"] },
        { key: "nested-b", title: "Nested B", url: "/nested-b", requiredPermissions: ["nested-b.view"] },
      ],
    },
  ];
  const permissions = new Set(["first.view", "second.view", "nested-a.view", "nested-b.view"]);
  // With nothing hidden, /first (config order) wins.
  assert.deepEqual(resolveTenantHomeRoute(permissions, menu, completed()), {
    kind: "redirect",
    path: "/first",
  });
  // Hiding the first item falls through to /second.
  assert.deepEqual(resolveTenantHomeRoute(permissions, menu, completed({}, { first: false })), {
    kind: "redirect",
    path: "/second",
  });
  // Hiding a whole group skips all of its children.
  assert.deepEqual(resolveTenantHomeRoute(permissions, menu, completed({}, { group: false })), {
    kind: "redirect",
    path: "/first",
  });
  // Hiding every reachable item yields no-access.
  assert.deepEqual(
    resolveTenantHomeRoute(permissions, menu, completed({}, { first: false, second: false, group: false })),
    { kind: "no-access" },
  );
});
