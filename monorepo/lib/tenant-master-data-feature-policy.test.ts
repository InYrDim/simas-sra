import assert from "node:assert/strict";
import test from "node:test";

import { parseMasterDataFeaturePolicy } from "@/lib/tenant-master-data-feature-policy";

const disabled = {
  read: false,
  write: false,
  importDownload: false,
  importValidation: false,
  importExecution: false,
};

test("Master Data parent disables every child capability", () => {
  assert.deepEqual(parseMasterDataFeaturePolicy({
    features: {
      masterData: false,
      masterDataRead: true,
      masterDataWrite: true,
      masterDataImportDownload: true,
      masterDataImportValidation: true,
      masterDataImportExecution: true,
    },
  }), disabled);
});

test("Master Data dependencies are resolved before capabilities are exposed", () => {
  assert.deepEqual(parseMasterDataFeaturePolicy({
    features: {
      masterData: true,
      masterDataRead: true,
      masterDataWrite: false,
      masterDataImportDownload: true,
      masterDataImportValidation: true,
      masterDataImportExecution: true,
    },
  }), {
    read: true,
    write: false,
    importDownload: true,
    importValidation: false,
    importExecution: false,
  });
});

test("Master Data feature policy fails closed for missing or non-boolean values", () => {
  assert.deepEqual(parseMasterDataFeaturePolicy(null), disabled);
  assert.deepEqual(parseMasterDataFeaturePolicy({}), disabled);
  assert.deepEqual(parseMasterDataFeaturePolicy({
    features: {
      masterData: "true",
      masterDataRead: true,
      masterDataWrite: true,
    },
  }), disabled);
});
