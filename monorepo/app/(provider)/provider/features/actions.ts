"use server";

import { revalidatePath } from "next/cache";

import { updateTenantFeatureConfiguration } from "@/lib/provider-feature-data";
import {
  PROVIDER_FEATURES,
  type ProviderFeatureSelection,
} from "@/lib/provider-feature-settings";
import { requireProviderActionAccess } from "@/lib/provider-access";

export type FeatureSettingsActionState =
  | { status: "idle" }
  | { status: "saved"; message: string }
  | { status: "error"; message: string };

export async function updateTenantFeaturesAction(
  tenantId: string,
  _previousState: FeatureSettingsActionState,
  formData: FormData,
): Promise<FeatureSettingsActionState> {
  await requireProviderActionAccess();

  const selection = Object.fromEntries(
    PROVIDER_FEATURES.map(({ key }) => [key, formData.get(key) === "on"]),
  ) as ProviderFeatureSelection;
  const updated = await updateTenantFeatureConfiguration(tenantId, selection);
  if (!updated) return { status: "error", message: "Tenant tidak ditemukan." };

  revalidatePath("/provider/features");
  revalidatePath("/provider/tenants");
  return { status: "saved", message: "Konfigurasi fitur berhasil disimpan." };
}
