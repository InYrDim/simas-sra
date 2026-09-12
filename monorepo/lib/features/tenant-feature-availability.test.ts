import assert from "node:assert/strict";
import test from "node:test";

import { resolveTenantFeatureAvailability } from "@/lib/features/tenant-feature-availability";

const enabledSettings = {
  features: {
    masterData: true,
    masterDataRead: true,
    masterDataWrite: true,
    masterDataImportDownload: true,
    masterDataImportValidation: true,
    masterDataImportExecution: true,
    ulangan: true,
    ulanganRead: true,
    ulanganWrite: true,
    ppdb: true,
    ppdbRead: true,
    ppdbWrite: true,
    ppdbPublic: true,
    advancedAnalytics: true,
  },
};

test("Provider-disabled child feature supplies actionable Tenant feedback", () => {
  const availability = resolveTenantFeatureAvailability({
    features: { ...enabledSettings.features, ulanganWrite: false },
  }, { write: true, downloadTemplate: true });

  assert.deepEqual(availability.ulanganWrite, {
    enabled: false,
    reason: "provider-disabled",
    message: "Pengelolaan Ulangan dinonaktifkan oleh Provider untuk Tenant ini.",
  });
  assert.equal(availability.ulanganRead.enabled, true);
});

test("Provider policy takes priority over read-only lifecycle feedback", () => {
  const availability = resolveTenantFeatureAvailability({
    features: { ...enabledSettings.features, ppdbWrite: false },
  }, { write: false, downloadTemplate: false });

  assert.equal(availability.ppdbWrite.reason, "provider-disabled");
  assert.deepEqual(availability.ulanganWrite, {
    enabled: false,
    reason: "read-only",
    message: "Tenant sedang dalam mode hanya-baca. Tindakan ini tidak tersedia.",
  });
});

test("Import capabilities distinguish downloads from write operations", () => {
  const availability = resolveTenantFeatureAvailability(enabledSettings, {
    write: false,
    downloadTemplate: true,
  });

  assert.equal(availability.masterDataImportDownload.enabled, true);
  assert.equal(availability.masterDataImportValidation.reason, "read-only");
  assert.equal(availability.masterDataImportExecution.reason, "read-only");
});

test("Provider-disabled Absensi features supply Indonesian feedback", () => {
  const availability = resolveTenantFeatureAvailability({
    features: {
      ...enabledSettings.features,
      absensi: false,
      absensiManual: false,
      absensiQr: false,
      absensiKartu: false,
      absensiGerbang: false,
      absensiKelas: false,
    },
  }, { write: true, downloadTemplate: true });

  assert.equal(availability.absensi.message, "Absensi dinonaktifkan oleh Provider untuk Tenant ini.");
  assert.equal(availability.absensiManual.message, "Mode Absensi Manual dinonaktifkan oleh Provider untuk Tenant ini.");
  assert.equal(availability.absensiQr.message, "Mode Absensi QR dinonaktifkan oleh Provider untuk Tenant ini.");
  assert.equal(availability.absensiKartu.message, "Mode Absensi Kartu dinonaktifkan oleh Provider untuk Tenant ini.");
  assert.equal(availability.absensiGerbang.message, "Lapisan Absensi Gerbang dinonaktifkan oleh Provider untuk Tenant ini.");
  assert.equal(availability.absensiKelas.message, "Lapisan Absensi Kelas dinonaktifkan oleh Provider untuk Tenant ini.");
});

test("Parent feature disables descendants with Provider feedback", () => {
  const availability = resolveTenantFeatureAvailability({
    features: { ...enabledSettings.features, masterData: false },
  }, { write: true, downloadTemplate: true });

  assert.equal(availability.masterDataRead.reason, "provider-disabled");
  assert.equal(availability.ulanganWrite.reason, "provider-disabled");
  assert.equal(availability.ppdbPublic.reason, "provider-disabled");
});
