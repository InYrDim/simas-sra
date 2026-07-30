import assert from "node:assert/strict";
import test from "node:test";

import {
  isTenantFeatureEnabled,
  resolveTenantFeatures,
} from "@/lib/features/tenant-feature-policy";

const fullyEnabledMasterData = {
  features: {
    masterData: true,
    masterDataRead: true,
    masterDataWrite: true,
    masterDataImportDownload: true,
    masterDataImportValidation: true,
    masterDataImportExecution: true,
  },
};

test("one effective decision can be enforced by UI, backend, and workers", () => {
  assert.equal(isTenantFeatureEnabled(fullyEnabledMasterData, "masterDataImportExecution"), true);
});

test("a disabled parent overrides enabled descendants", () => {
  const settings = {
    features: {
      ...fullyEnabledMasterData.features,
      masterData: false,
    },
  };

  const effective = resolveTenantFeatures(settings);
  assert.equal(effective.masterData, false);
  assert.equal(effective.masterDataRead, false);
  assert.equal(effective.masterDataWrite, false);
  assert.equal(effective.masterDataImportExecution, false);
});

test("legacy Master Data child flags remain enabled until the parent is explicitly saved", () => {
  assert.equal(isTenantFeatureEnabled({
    features: { masterDataRead: true },
  }, "masterDataRead"), true);
});

test("unknown, missing, and non-boolean values fail closed", () => {
  assert.equal(isTenantFeatureEnabled(null, "advancedAnalytics"), false);
  assert.equal(isTenantFeatureEnabled({ features: { advancedAnalytics: "true" } }, "advancedAnalytics"), false);
  assert.equal(isTenantFeatureEnabled({
    features: { masterData: "true", masterDataRead: true },
  }, "masterDataRead"), false);
});
