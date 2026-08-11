import { TENANT_FEATURES, type TenantFeatureKey } from "@/config/tenant-features";
import { resolveTenantFeatures, type TenantFeatureSelection } from "@/lib/features/tenant-feature-policy";

export type TenantFeatureAvailabilityReason = "provider-disabled" | "read-only";

export type TenantFeatureAvailability = Readonly<{
  enabled: boolean;
  reason: TenantFeatureAvailabilityReason | null;
  message: string | null;
}>;

export type TenantFeatureAvailabilitySnapshot = Record<TenantFeatureKey, TenantFeatureAvailability>;

export type TenantLifecycleCapabilities = Readonly<{
  write: boolean;
  downloadTemplate: boolean;
}>;

const writeFeatures = new Set<TenantFeatureKey>([
  "masterDataWrite",
  "masterDataImportValidation",
  "masterDataImportExecution",
  "ulanganWrite",
  "ppdbWrite",
]);

function providerDisabledMessage(feature: TenantFeatureKey): string {
  if (feature === "ulanganWrite") {
    return "Pengelolaan Ulangan dinonaktifkan oleh Provider untuk Tenant ini.";
  }
  if (feature === "ppdbWrite") {
    return "Pengelolaan PPDB dinonaktifkan oleh Provider untuk Tenant ini.";
  }
  if (feature === "ppdbPublic") {
    return "Pendaftaran PPDB publik dinonaktifkan oleh Provider untuk Tenant ini.";
  }
  if (feature === "masterDataWrite") {
    return "Pengelolaan Master Data dinonaktifkan oleh Provider untuk Tenant ini.";
  }
  if (feature === "absensi") {
    return "Absensi dinonaktifkan oleh Provider untuk Tenant ini.";
  }
  if (feature === "absensiManual") {
    return "Mode Absensi Manual dinonaktifkan oleh Provider untuk Tenant ini.";
  }
  if (feature === "absensiQr") {
    return "Mode Absensi QR dinonaktifkan oleh Provider untuk Tenant ini.";
  }
  if (feature === "absensiKartu") {
    return "Mode Absensi Kartu dinonaktifkan oleh Provider untuk Tenant ini.";
  }
  if (feature === "absensiGerbang") {
    return "Lapisan Absensi Gerbang dinonaktifkan oleh Provider untuk Tenant ini.";
  }
  if (feature === "absensiKelas") {
    return "Lapisan Absensi Kelas dinonaktifkan oleh Provider untuk Tenant ini.";
  }

  const label = TENANT_FEATURES.find(({ key }) => key === feature)?.label ?? feature;
  return `${label} dinonaktifkan oleh Provider untuk Tenant ini.`;
}

function availabilityFor(
  feature: TenantFeatureKey,
  effective: TenantFeatureSelection,
  capabilities: TenantLifecycleCapabilities,
): TenantFeatureAvailability {
  if (!effective[feature]) {
    return {
      enabled: false,
      reason: "provider-disabled",
      message: providerDisabledMessage(feature),
    };
  }

  const lifecycleAllowsFeature = feature === "masterDataImportDownload"
    ? capabilities.downloadTemplate
    : !writeFeatures.has(feature) || capabilities.write;
  if (!lifecycleAllowsFeature) {
    return {
      enabled: false,
      reason: "read-only",
      message: "Tenant sedang dalam mode hanya-baca. Tindakan ini tidak tersedia.",
    };
  }

  return { enabled: true, reason: null, message: null };
}

export function resolveTenantFeatureAvailability(
  settings: unknown,
  capabilities: TenantLifecycleCapabilities,
): TenantFeatureAvailabilitySnapshot {
  const effective = resolveTenantFeatures(settings);
  return Object.fromEntries(
    TENANT_FEATURES.map(({ key }) => [key, availabilityFor(key, effective, capabilities)]),
  ) as TenantFeatureAvailabilitySnapshot;
}
