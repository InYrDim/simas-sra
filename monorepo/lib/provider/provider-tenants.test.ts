import assert from "node:assert/strict";
import test from "node:test";

import { literalLikePattern, normalizeTenantListQuery, projectProviderSchoolAdminRoster } from "@/lib/provider/provider-tenants";

test("tenant search treats SQL wildcard characters literally", () => {
  assert.equal(literalLikePattern("100%_==school"), "%100=%=_====school%");
});

test("Provider Tenant roster preserves 1..n dedicated authorities and counts only usable compatibility rows", () => {
  const roster = projectProviderSchoolAdminRoster([
    { authorityId: "a", authorityState: "active", legacyRole: "school-admin", schoolAdminUserId: "admin-a" },
    { authorityId: "b", authorityState: "active", legacyRole: "school-admin", schoolAdminUserId: "admin-b" },
    { authorityId: "c", authorityState: "disabled", legacyRole: null, schoolAdminUserId: "admin-c" },
    { authorityId: "d", authorityState: "none", legacyRole: null, schoolAdminUserId: "admin-d" },
    { authorityId: "e", authorityState: "active", legacyRole: "school-admin", accountLifecycle: "inactive", schoolAdminUserId: "admin-e" },
  ]);
  assert.equal(roster.schoolAdmins.length, 5);
  assert.deepEqual(roster.activeSchoolAdmins.map((admin) => admin.schoolAdminUserId), ["admin-a", "admin-b"]);
  assert.equal(roster.activeSchoolAdminCount, 2);
  assert.equal(roster.coverage, "managed");
  assert.equal(projectProviderSchoolAdminRoster([
    { authorityId: "c", authorityState: "disabled", legacyRole: null, schoolAdminUserId: "admin-c" },
  ]).coverage, "reconciliation-required");
});

test("tenant list query normalizes supported filters, sorting, and pagination", () => {
  assert.deepEqual(
    normalizeTenantListQuery({
      page: "3",
      search: "  SMAN 1  ",
      sort: "school-desc",
      stage: "ending-soon",
    }),
    {
      page: 3,
      search: "SMAN 1",
      sort: "school-desc",
      stage: "ending-soon",
    },
  );

  assert.deepEqual(
    normalizeTenantListQuery({ page: "0", search: "   ", sort: "unknown", stage: "unknown" }),
    { page: 1, search: undefined, sort: "newest", stage: "all" },
  );
});
