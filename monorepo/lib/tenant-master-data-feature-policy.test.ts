import assert from "node:assert/strict";
import test from "node:test";
import { parseMasterDataFeaturePolicy } from "@/lib/tenant-master-data-feature-policy";
const disabled = { read: false, write: false, importDownload: false, importValidation: false, importExecution: false };
test("Master Data and import flags are parsed independently", () => {
  assert.deepEqual(parseMasterDataFeaturePolicy({ features: { masterDataRead: true, masterDataWrite: false, masterDataImportDownload: true, masterDataImportValidation: false, masterDataImportExecution: true } }), { read: true, write: false, importDownload: true, importValidation: false, importExecution: true });
  assert.deepEqual(parseMasterDataFeaturePolicy({ features: { masterDataRead: false, masterDataWrite: true, masterDataImportDownload: false, masterDataImportValidation: true } }), { read: false, write: true, importDownload: false, importValidation: true, importExecution: false });
});
test("Master Data feature policy fails closed for missing or non-boolean values", () => {
  assert.deepEqual(parseMasterDataFeaturePolicy(null), disabled); assert.deepEqual(parseMasterDataFeaturePolicy({}), disabled);
  assert.deepEqual(parseMasterDataFeaturePolicy({ features: { masterDataRead: "true", masterDataWrite: 1, masterDataImportDownload: "true" } }), disabled);
});
