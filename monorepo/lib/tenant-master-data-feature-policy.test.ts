import assert from "node:assert/strict";
import test from "node:test";

import { parseMasterDataFeaturePolicy } from "@/lib/tenant-master-data-feature-policy";

test("Master Data read and write flags are parsed independently", () => {
  assert.deepEqual(parseMasterDataFeaturePolicy({
    features: { masterDataRead: true, masterDataWrite: false },
  }), { read: true, write: false });
  assert.deepEqual(parseMasterDataFeaturePolicy({
    features: { masterDataRead: false, masterDataWrite: true },
  }), { read: false, write: true });
});

test("Master Data feature policy fails closed for missing or non-boolean values", () => {
  assert.deepEqual(parseMasterDataFeaturePolicy(null), { read: false, write: false });
  assert.deepEqual(parseMasterDataFeaturePolicy({}), { read: false, write: false });
  assert.deepEqual(parseMasterDataFeaturePolicy({
    features: { masterDataRead: "true", masterDataWrite: 1 },
  }), { read: false, write: false });
});
