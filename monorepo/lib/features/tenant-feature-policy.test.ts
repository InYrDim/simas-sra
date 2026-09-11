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

test("legacy tenants keep Ulangan and PPDB enabled until explicitly configured", () => {
  assert.equal(isTenantFeatureEnabled(fullyEnabledMasterData, "ulanganWrite"), true);
  assert.equal(isTenantFeatureEnabled(fullyEnabledMasterData, "ppdbPublic"), true);
});

test("Ulangan and PPDB descendants follow their parent and Master Data dependencies", () => {
  const settings = {
    features: {
      ...fullyEnabledMasterData.features,
      ulangan: false,
      ulanganRead: true,
      ulanganWrite: true,
      ppdb: true,
      ppdbRead: true,
      ppdbWrite: true,
      ppdbPublic: true,
    },
  };

  assert.equal(isTenantFeatureEnabled(settings, "ulanganRead"), false);
  assert.equal(isTenantFeatureEnabled(settings, "ulanganWrite"), false);
  assert.equal(isTenantFeatureEnabled(settings, "ppdbWrite"), true);
  assert.equal(isTenantFeatureEnabled({
    features: { ...settings.features, masterData: false },
  }, "ppdbPublic"), false);
});

test("explicit Ulangan and PPDB child flags fail closed", () => {
  assert.equal(isTenantFeatureEnabled({
    features: { ...fullyEnabledMasterData.features, ulangan: true, ulanganRead: false },
  }, "ulanganRead"), false);
  assert.equal(isTenantFeatureEnabled({
    features: { ...fullyEnabledMasterData.features, ppdb: true, ppdbPublic: false },
  }, "ppdbPublic"), false);
});

test("unknown, missing, and non-boolean values fail closed", () => {
  assert.equal(isTenantFeatureEnabled(null, "advancedAnalytics"), false);
  assert.equal(isTenantFeatureEnabled({ features: { advancedAnalytics: "true" } }, "advancedAnalytics"), false);
  assert.equal(isTenantFeatureEnabled({
    features: { masterData: "true", masterDataRead: true },
  }, "masterDataRead"), false);
});

test("legacy tenants keep the Absensi parent enabled until explicitly configured", () => {
  assert.equal(isTenantFeatureEnabled(fullyEnabledMasterData, "absensi"), true);
});

test("Absensi mode and layer capabilities are opt-in for legacy tenants", () => {
  assert.equal(isTenantFeatureEnabled(fullyEnabledMasterData, "absensiManual"), false);
  assert.equal(isTenantFeatureEnabled(fullyEnabledMasterData, "absensiQr"), false);
  assert.equal(isTenantFeatureEnabled(fullyEnabledMasterData, "absensiKartu"), false);
  assert.equal(isTenantFeatureEnabled(fullyEnabledMasterData, "absensiGerbang"), false);
  assert.equal(isTenantFeatureEnabled(fullyEnabledMasterData, "absensiKelas"), false);
});

test("Absensi mode and layer capabilities require the parent and fail closed when disabled", () => {
  const settings = {
    features: {
      ...fullyEnabledMasterData.features,
      absensi: true,
      absensiManual: true,
      absensiQr: true,
      absensiKartu: true,
      absensiGerbang: true,
      absensiKelas: true,
    },
  };
  assert.equal(isTenantFeatureEnabled(settings, "absensiManual"), true);
  assert.equal(isTenantFeatureEnabled(settings, "absensiGerbang"), true);

  const parentOff = { features: { ...settings.features, absensi: false } };
  assert.equal(isTenantFeatureEnabled(parentOff, "absensiManual"), false);
  assert.equal(isTenantFeatureEnabled(parentOff, "absensiGerbang"), false);
});

test("Integrasi is opt-in for tenants and integrates follows its parent and Master Data dependency", () => {
  assert.equal(isTenantFeatureEnabled(fullyEnabledMasterData, "integrasi"), false);
  assert.equal(isTenantFeatureEnabled(fullyEnabledMasterData, "integrasiRead"), false);

  const enabled = {
    features: { ...fullyEnabledMasterData.features, integrasi: true, integrasiRead: true },
  };
  assert.equal(isTenantFeatureEnabled(enabled, "integrasi"), true);
  assert.equal(isTenantFeatureEnabled(enabled, "integrasiRead"), true);

  assert.equal(isTenantFeatureEnabled({
    features: { ...enabled.features, masterData: false },
  }, "integrasiRead"), false);
  assert.equal(isTenantFeatureEnabled({
    features: { ...enabled.features, integrasi: false },
  }, "integrasiRead"), false);
});
