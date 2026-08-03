import assert from "node:assert/strict";
import test from "node:test";

import {
  projectTenantUserDirectoryRow,
  tenantUserDirectoryProjection,
} from "@/lib/authorization/tenant-user-directory";

const row = {
  id: "user-1",
  name: "Ayu",
  email: "ayu@example.test",
  tenantRole: "guru",
  emailVerified: true,
};

test("ordinary directory projection never includes contact or account state", () => {
  assert.deepEqual(tenantUserDirectoryProjection({ contact: false, sensitive: false }), ["id", "name"]);
  assert.deepEqual(projectTenantUserDirectoryRow(row, { contact: false, sensitive: false }), {
    id: "user-1",
    name: "Ayu",
  });
});

test("contact and sensitive directory projections are independently additive", () => {
  assert.deepEqual(projectTenantUserDirectoryRow(row, { contact: true, sensitive: false }), {
    id: "user-1",
    name: "Ayu",
    email: "ayu@example.test",
  });
  assert.deepEqual(projectTenantUserDirectoryRow(row, { contact: false, sensitive: true }), {
    id: "user-1",
    name: "Ayu",
    tenantRole: "guru",
    emailVerified: true,
  });
});
