import assert from "node:assert/strict";
import test from "node:test";

import { isProviderRouteActive } from "@/components/provider-navigation/is-provider-route-active";

test("Provider root is active only at the exact root route", () => {
  assert.equal(isProviderRouteActive("/provider", "/provider"), true);
  assert.equal(isProviderRouteActive("/provider/tenants", "/provider"), false);
});

test("Provider sections remain active for detail routes", () => {
  assert.equal(
    isProviderRouteActive("/provider/tenants/tenant-123", "/provider/tenants"),
    true,
  );
  assert.equal(
    isProviderRouteActive("/provider/tenantship", "/provider/tenants"),
    false,
  );
});

test("Query strings do not change the active Provider section", () => {
  assert.equal(
    isProviderRouteActive(
      "/provider/tenants?tab=applications",
      "/provider/tenants",
    ),
    true,
  );
});
