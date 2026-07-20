import type { MasterDataFeaturePolicy } from "@/lib/tenant-master-data-access";

export function parseMasterDataFeaturePolicy(settings: unknown): MasterDataFeaturePolicy {
  const disabled = { read: false, write: false, importDownload: false, importValidation: false } as const;
  if (!settings || typeof settings !== "object") return disabled;
  const features = (settings as Record<string, unknown>).features;
  if (!features || typeof features !== "object") return disabled;
  const values = features as Record<string, unknown>;
  return {
    read: values.masterDataRead === true,
    write: values.masterDataWrite === true,
    importDownload: values.masterDataImportDownload === true,
    importValidation: values.masterDataImportValidation === true,
  };
}
