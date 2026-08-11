import assert from "node:assert/strict";
import test from "node:test";

import {
  mergeProviderFeatureSelection,
  readProviderFeatureSelection,
} from "@/lib/provider/provider-feature-settings";

const selection = {
  masterData: true,
  masterDataRead: true,
  masterDataWrite: true,
  masterDataImportDownload: false,
  masterDataImportValidation: false,
  masterDataImportExecution: false,
  ulangan: true,
  ulanganRead: true,
  ulanganWrite: true,
  ppdb: true,
  ppdbRead: true,
  ppdbWrite: true,
  ppdbPublic: true,
  advancedAnalytics: true,
  absensi: true,
  absensiManual: false,
  absensiQr: false,
  absensiKartu: false,
  absensiGerbang: false,
  absensiKelas: false,
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

test("feature settings preserve legacy Ulangan and PPDB access until explicitly configured", () => {
  assert.deepEqual(readProviderFeatureSelection(null), {
    masterData: false,
    masterDataRead: false,
    masterDataWrite: false,
    masterDataImportDownload: false,
    masterDataImportValidation: false,
    masterDataImportExecution: false,
    ulangan: true,
    ulanganRead: true,
    ulanganWrite: true,
    ppdb: true,
    ppdbRead: true,
    ppdbWrite: true,
    ppdbPublic: true,
    advancedAnalytics: false,
    absensi: true,
    absensiManual: false,
    absensiQr: false,
    absensiKartu: false,
    absensiGerbang: false,
    absensiKelas: false,
  });
});
