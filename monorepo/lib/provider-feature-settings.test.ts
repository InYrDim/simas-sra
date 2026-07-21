import assert from "node:assert/strict";
import test from "node:test";

import {
  mergeProviderFeatureSelection,
  readProviderFeatureSelection,
} from "@/lib/provider-feature-settings";

const selection = {
  masterDataRead: true,
  masterDataWrite: true,
  masterDataImportDownload: false,
  masterDataImportValidation: false,
  masterDataImportExecution: false,
  advancedAnalytics: true,
};

test("feature settings preserve onboarding and unknown feature configuration", () => {
  assert.deepEqual(
    mergeProviderFeatureSelection({
      schoolYear: "2026/2027",
      timezone: "Asia/Makassar",
      features: { futureFeature: true, masterDataRead: false },
    }, selection),
    {
      schoolYear: "2026/2027",
      timezone: "Asia/Makassar",
      features: { futureFeature: true, ...selection },
    },
  );
});

test("feature settings default every known feature to disabled", () => {
  assert.deepEqual(readProviderFeatureSelection(null), {
    masterDataRead: false,
    masterDataWrite: false,
    masterDataImportDownload: false,
    masterDataImportValidation: false,
    masterDataImportExecution: false,
    advancedAnalytics: false,
  });
});
