import assert from "node:assert/strict";
import test from "node:test";

import { findForbiddenLegacyAuthorityReferences } from "@/lib/authorization/tenant-rbac-legacy-authority-verifier";

test("forbidden-reference verifier excludes compatibility migration code", () => {
  const findings = findForbiddenLegacyAuthorityReferences([
    { path: "lib/authorization/tenant-authorization-data.ts", content: "return user.tenantRole === 'staff';" },
    { path: "lib/authorization/legacy-non-admin-backfill-data.ts", content: "return user.tenantRole === 'staff';" },
  ]);
  assert.deepEqual(findings, [{ file: "lib/authorization/tenant-authorization-data.ts", line: 1, reference: "user\\.tenantRole\\b" }]);
});

test("verifier reports every runtime legacy authority reference", () => {
  const findings = findForbiddenLegacyAuthorityReferences([
    { path: "app/route.ts", content: "const role = account.legacyRole;\nconst same = user.tenantRole;" },
  ]);
  assert.equal(findings.length, 2);
  assert.equal(findings[0]?.line, 1);
  assert.equal(findings[1]?.line, 2);
});
