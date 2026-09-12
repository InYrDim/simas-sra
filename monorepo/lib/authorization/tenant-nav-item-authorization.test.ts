import assert from "node:assert/strict";
import test from "node:test";

import { isNavigationItemAuthorized } from "@/lib/authorization/tenant-nav-item-authorization";

test("authorizes any member when requiredPermissions is empty (fallback)", () => {
  assert.equal(isNavigationItemAuthorized({ requiredPermissions: [] }, new Set()), false);
  assert.equal(isNavigationItemAuthorized({ requiredPermissions: [] }, new Set(["tenant.users.view"])), true);
  assert.equal(isNavigationItemAuthorized({ requiredPermissions: undefined }, new Set(["tenant.users.view"])), true);
  assert.equal(isNavigationItemAuthorized({}, new Set(["tenant.users.view"])), true);
});

test("mode 'any' authorizes when at least one required permission is held", () => {
  const item = { requiredPermissions: ["absensi.attendance.view", "tenant.users.view"], permissionMode: "any" as const };
  assert.equal(isNavigationItemAuthorized(item, new Set(["tenant.users.view"])), true);
  assert.equal(isNavigationItemAuthorized(item, new Set(["absensi.attendance.view"])), true);
  assert.equal(isNavigationItemAuthorized(item, new Set(["tenant.dashboard.view"])), false);
  assert.equal(isNavigationItemAuthorized(item, new Set()), false);
});

test("default (and explicit 'all') mode requires every required permission", () => {
  const item = { requiredPermissions: ["absensi.attendance.view", "tenant.dashboard.view"] };
  assert.equal(isNavigationItemAuthorized(item, new Set(["absensi.attendance.view", "tenant.dashboard.view"])), true);
  assert.equal(isNavigationItemAuthorized(item, new Set(["absensi.attendance.view"])), false);
  assert.equal(isNavigationItemAuthorized(item, new Set()), false);
  const allMode = { requiredPermissions: ["absensi.attendance.view", "tenant.dashboard.view"], permissionMode: "all" as const };
  assert.equal(isNavigationItemAuthorized(allMode, new Set(["absensi.attendance.view", "tenant.dashboard.view"])), true);
  assert.equal(isNavigationItemAuthorized(allMode, new Set(["tenant.dashboard.view"])), false);
});
