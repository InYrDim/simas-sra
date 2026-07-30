import {
  TENANT_FEATURES,
  type TenantFeatureKey,
} from "@/config/tenant-features";

export { TENANT_FEATURES, type TenantFeatureKey } from "@/config/tenant-features";
export type TenantFeatureSelection = Record<TenantFeatureKey, boolean>;

const definitions = new Map<TenantFeatureKey, (typeof TENANT_FEATURES)[number]>(
  TENANT_FEATURES.map((feature) => [feature.key, feature]),
);

export function readTenantFeatureSelection(settings: unknown): TenantFeatureSelection {
  const root = settings && typeof settings === "object"
    ? settings as Record<string, unknown>
    : {};
  const features = root.features && typeof root.features === "object"
    ? root.features as Record<string, unknown>
    : {};

  const selection = Object.fromEntries(
    TENANT_FEATURES.map(({ key }) => [key, features[key] === true]),
  ) as TenantFeatureSelection;

  const hasExplicitMasterData = Object.prototype.hasOwnProperty.call(features, "masterData");
  if (!hasExplicitMasterData) {
    selection.masterData = [
      "masterDataRead",
      "masterDataWrite",
      "masterDataImportDownload",
      "masterDataImportValidation",
      "masterDataImportExecution",
    ].some((key) => features[key] === true);
  }

  return selection;
}

export function isTenantFeatureEnabled(
  settings: unknown,
  feature: TenantFeatureKey,
): boolean {
  const selected = readTenantFeatureSelection(settings);
  const visited = new Set<TenantFeatureKey>();

  function enabled(key: TenantFeatureKey): boolean {
    if (!selected[key] || visited.has(key)) return false;
    visited.add(key);
    const definition = definitions.get(key);
    const requirements = definition && "requires" in definition ? definition.requires : [];
    const result = requirements.every((required) => enabled(required));
    visited.delete(key);
    return result;
  }

  return enabled(feature);
}

export function resolveTenantFeatures(settings: unknown): TenantFeatureSelection {
  return Object.fromEntries(
    TENANT_FEATURES.map(({ key }) => [key, isTenantFeatureEnabled(settings, key)]),
  ) as TenantFeatureSelection;
}

export function mergeTenantFeatureSelection(
  settings: unknown,
  selection: TenantFeatureSelection,
): Record<string, unknown> {
  const root = settings && typeof settings === "object"
    ? { ...settings as Record<string, unknown> }
    : {};
  const existingFeatures = root.features && typeof root.features === "object"
    ? root.features as Record<string, unknown>
    : {};

  return {
    ...root,
    features: {
      ...existingFeatures,
      ...selection,
    },
  };
}
