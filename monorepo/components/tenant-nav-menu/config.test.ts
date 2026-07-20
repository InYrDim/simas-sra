import assert from "node:assert/strict";
import test from "node:test";

import { tenantMenuItems } from "@/components/tenant-nav-menu/config";

const masterData = tenantMenuItems.find((item) => item.title === "Master Data");

test("Master Data and every child menu are visible only to School Admin", () => {
  assert.ok(masterData);
  assert.deepEqual(masterData.roles, ["school-admin"]);
  assert.ok(masterData.items?.length);
  for (const item of masterData.items ?? []) {
    assert.deepEqual(item.roles, ["school-admin"], item.title);
  }
});
