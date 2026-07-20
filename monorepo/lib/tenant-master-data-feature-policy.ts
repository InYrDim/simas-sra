import type { MasterDataFeaturePolicy } from "@/lib/tenant-master-data-access";

export function parseMasterDataFeaturePolicy(settings: unknown): MasterDataFeaturePolicy {
  if (!settings || typeof settings !== "object") return { read: false, write: false };
  const features = (settings as Record<string, unknown>).features;
  if (!features || typeof features !== "object") return { read: false, write: false };
  const values = features as Record<string, unknown>;
  return {
    read: values.masterDataRead === true,
    write: values.masterDataWrite === true,
  };
}
