import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzeTenantAuthorizationCoverage,
  checkTenantAuthorizationCoverage,
} from "@/lib/authorization/tenant-rbac-coverage";

test("the authenticated Tenant architecture is exhaustively classified", async () => {
  const report = await checkTenantAuthorizationCoverage(new URL("../..", import.meta.url));
  assert.deepEqual(report.issues, []);
  assert.ok(report.discoveredEntryPoints.length > 80);
  assert.equal(report.discoveredEntryPoints.length, report.mappedEntryPoints.length);
});

test("coverage fails closed for unmapped entry points and undeclared final authority", () => {
  const report = analyzeTenantAuthorizationCoverage({
    discoveredEntryPoints: [
      { id: "action:app/example/actions.ts#unsafeAction", authorityMarkers: ["tenantRole"] },
    ],
    mappedEntryPoints: [],
  });
  assert.deepEqual(report.issues, [
    { code: "unmapped-entry-point", entryPoint: "action:app/example/actions.ts#unsafeAction" },
    { code: "undeclared-authority-decision", entryPoint: "action:app/example/actions.ts#unsafeAction", marker: "tenantRole" },
  ]);
});

test("explicit outside and placeholder classifications do not invent permissions", () => {
  const report = analyzeTenantAuthorizationCoverage({
    discoveredEntryPoints: [
      { id: "page:app/example/page.tsx", authorityMarkers: [] },
    ],
    mappedEntryPoints: [
      {
        id: "page:app/example/page.tsx",
        classification: "placeholder",
        permissions: [],
        declaredAuthorityMarkers: [],
      },
    ],
  });
  assert.deepEqual(report.issues, []);
});
