import type { MasterDataFeaturePolicy } from "@/lib/tenant-master-data-access";
import { isTenantFeatureEnabled } from "@/lib/tenant-feature-policy";

export function parseMasterDataFeaturePolicy(settings: unknown): MasterDataFeaturePolicy {
  return {
    read: isTenantFeatureEnabled(settings, "masterDataRead"),
    write: isTenantFeatureEnabled(settings, "masterDataWrite"),
    importDownload: isTenantFeatureEnabled(settings, "masterDataImportDownload"),
    importValidation: isTenantFeatureEnabled(settings, "masterDataImportValidation"),
    importExecution: isTenantFeatureEnabled(settings, "masterDataImportExecution"),
  };
}
