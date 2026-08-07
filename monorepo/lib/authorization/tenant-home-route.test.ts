import assert from "node:assert/strict";
import test from "node:test";

import { tenantMenuItems } from "@/components/tenant-nav-menu/config";
import { isNavigationItemAuthorized } from "@/components/tenant-nav-menu";
import { resolveTenantHomeRoute } from "@/lib/authorization/tenant-home-route";
import type { TenantNavItem } from "@/types/components/TenantNavItem";

test("keeps /dashboard as the home route when the principal holds tenant.dashboard.view", () => {
  assert.deepEqual(resolveTenantHomeRoute(new Set(["tenant.dashboard.view"]), tenantMenuItems), {
    kind: "dashboard",
    path: "/dashboard",
  });
  assert.deepEqual(
    resolveTenantHomeRoute(new Set(["tenant.dashboard.view", "absensi.attendance.view"]), tenantMenuItems),
    { kind: "dashboard", path: "/dashboard" },
  );
});

test("redirects to the first authorized menu page when dashboard access is missing", () => {
  assert.deepEqual(resolveTenantHomeRoute(new Set(["absensi.attendance.view"]), tenantMenuItems), {
    kind: "redirect",
    path: "/absensi",
  });
  assert.deepEqual(resolveTenantHomeRoute(new Set(["tenant.authorization-audit.view"]), tenantMenuItems), {
    kind: "redirect",
    path: "/e-library",
  });
  assert.deepEqual(resolveTenantHomeRoute(new Set(["quizzes.sessions.view"]), tenantMenuItems), {
    kind: "redirect",
    path: "/ulangan",
  });
  assert.deepEqual(resolveTenantHomeRoute(new Set(["tenant.users.view"]), tenantMenuItems), {
    kind: "redirect",
    path: "/users",
  });
});

test("walks nested menu groups in config order to find the first allowed page", () => {
  assert.deepEqual(resolveTenantHomeRoute(new Set(["ppdb.submissions.view"]), tenantMenuItems), {
    kind: "redirect",
    path: "/ppdb",
  });
  assert.deepEqual(resolveTenantHomeRoute(new Set(["school-profile.profile.view"]), tenantMenuItems), {
    kind: "redirect",
    path: "/master",
  });
});

test("returns no-access for a principal without any permission", () => {
  assert.deepEqual(resolveTenantHomeRoute(new Set(), tenantMenuItems), { kind: "no-access" });
});

test("returns no-access when permissions authorize no menu page", () => {
  assert.deepEqual(resolveTenantHomeRoute(new Set(["tenant.onboarding.complete"]), tenantMenuItems), {
    kind: "no-access",
  });
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
    const decision = resolveTenantHomeRoute(new Set(keys), tenantMenuItems);
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
    const decision = resolveTenantHomeRoute(new Set(keys), tenantMenuItems);
    if (decision.kind !== "redirect") continue;
    const allItems = tenantMenuItems.flatMap((item) => item.items ?? [item]);
    const target = allItems.find((item) => item.url === decision.path);
    assert.ok(target, `no menu item with url ${decision.path}`);
    assert.equal(isNavigationItemAuthorized(target, new Set(keys)), true, decision.path);
  }
});

test("respects config ordering on a synthetic menu", () => {
  const menu: TenantNavItem[] = [
    { title: "Home", url: "/dashboard", requiredPermissions: ["tenant.dashboard.view"] },
    { title: "First", url: "/first", requiredPermissions: ["first.view"] },
    {
      title: "Group",
      items: [
        { title: "Nested A", url: "/nested-a", requiredPermissions: ["nested-a.view"] },
        { title: "Nested B", url: "/nested-b", requiredPermissions: ["nested-b.view"] },
      ],
    },
  ];
  assert.deepEqual(resolveTenantHomeRoute(new Set(["first.view"]), menu), {
    kind: "redirect",
    path: "/first",
  });
  assert.deepEqual(resolveTenantHomeRoute(new Set(["nested-b.view"]), menu), {
    kind: "redirect",
    path: "/nested-b",
  });
  assert.deepEqual(resolveTenantHomeRoute(new Set(["other.view"]), menu), { kind: "no-access" });
});
