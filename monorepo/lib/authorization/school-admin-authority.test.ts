import assert from "node:assert/strict";
import test from "node:test";

import {
  planSchoolAdminCompatibilityProjection,
  resolveSchoolAdminAuthority,
  schoolAdminAllowedForMode,
  type SchoolAdminCompatibilitySnapshot,
} from "@/lib/authorization/school-admin-authority";

const base: SchoolAdminCompatibilitySnapshot = {
  userId: "admin-1",
  tenantId: "tenant-1",
  legacyRole: "school-admin",
  tenantExists: true,
  providerAdmin: false,
  applicant: false,
  authorities: [],
};

test("projects a valid legacy School Admin exactly once without a custom role", () => {
  assert.deepEqual(planSchoolAdminCompatibilityProjection(base), {
    kind: "project",
    tenantId: "tenant-1",
    userId: "admin-1",
  });
  assert.deepEqual(planSchoolAdminCompatibilityProjection({
    ...base,
    authorities: [{ id: "authority-1", tenantId: "tenant-1", userId: "admin-1", authorityState: "active" }],
  }), {
    kind: "unchanged",
    authorityId: "authority-1",
    tenantId: "tenant-1",
    userId: "admin-1",
  });
});

test("ambiguous, cross-Tenant, malformed, and conflicting projections fail closed", () => {
  const cases = [
    {
      snapshot: { ...base, authorities: [
        { id: "a", tenantId: "tenant-1", userId: "admin-1", authorityState: "active" },
        { id: "b", tenantId: "tenant-1", userId: "admin-1", authorityState: "active" },
      ] },
      code: "school-admin-authority-duplicate",
    },
    {
      snapshot: { ...base, authorities: [{ id: "a", tenantId: "tenant-2", userId: "admin-1", authorityState: "active" }] },
      code: "school-admin-authority-cross-tenant",
    },
    {
      snapshot: { ...base, authorities: [{ id: "a", tenantId: "tenant-1", userId: "admin-1", authorityState: "disabled" }] },
      code: "school-admin-authority-malformed",
    },
    {
      snapshot: { ...base, providerAdmin: true },
      code: "school-admin-identity-conflict",
    },
  ] as const;

  for (const { snapshot, code } of cases) {
    assert.deepEqual(planSchoolAdminCompatibilityProjection(snapshot), {
      kind: "finding",
      code,
      tenantId: "tenant-1",
      userId: "admin-1",
    });
    assert.equal(schoolAdminAllowedForMode(resolveSchoolAdminAuthority(snapshot), "rbac"), false);
  }
});

test("mode resolution preserves legacy, intersects compatibility, and recognizes dedicated RBAC authority", () => {
  const legacyOnly = resolveSchoolAdminAuthority(base);
  assert.equal(schoolAdminAllowedForMode(legacyOnly, "legacy"), true);
  assert.equal(schoolAdminAllowedForMode(legacyOnly, "intersection"), false);
  assert.equal(schoolAdminAllowedForMode(legacyOnly, "rbac"), false);

  const compatible = resolveSchoolAdminAuthority({
    ...base,
    authorities: [{ id: "authority-1", tenantId: "tenant-1", userId: "admin-1", authorityState: "active" }],
  });
  assert.equal(schoolAdminAllowedForMode(compatible, "legacy"), true);
  assert.equal(schoolAdminAllowedForMode(compatible, "intersection"), true);
  assert.equal(schoolAdminAllowedForMode(compatible, "rbac"), true);

  const dedicatedOnly = resolveSchoolAdminAuthority({ ...base, legacyRole: null, authorities: [{ id: "authority-1", tenantId: "tenant-1", userId: "admin-1", authorityState: "active" }] });
  assert.equal(schoolAdminAllowedForMode(dedicatedOnly, "legacy"), false);
  assert.equal(schoolAdminAllowedForMode(dedicatedOnly, "rbac"), true);
});

test("a dedicated authority cannot coexist with a non-admin legacy projection", () => {
  const snapshot = {
    ...base,
    legacyRole: "staff",
    authorities: [{ id: "authority-1", tenantId: "tenant-1", userId: "admin-1", authorityState: "active" }],
  };
  const resolution = resolveSchoolAdminAuthority(snapshot);
  assert.equal(resolution.ambiguous, true);
  assert.equal(schoolAdminAllowedForMode(resolution, "rbac"), false);
});
