import {
  TENANT_FEATURES,
  type TenantFeatureKey,
} from "@/config/tenant-features";
import {
  mergeTenantFeatureSelection,
  readTenantFeatureSelection,
  type TenantFeatureSelection,
} from "@/lib/tenant-feature-policy";

export const PROVIDER_FEATURES = TENANT_FEATURES;
export type ProviderFeatureKey = TenantFeatureKey;
export type ProviderFeatureSelection = TenantFeatureSelection;
export const readProviderFeatureSelection = readTenantFeatureSelection;
export const mergeProviderFeatureSelection = mergeTenantFeatureSelection;
