"use server";

import { revalidatePath } from "next/cache";

import { requireProviderActionAccess } from "@/lib/provider/provider-access";
import {
  normalizeTenantOpenWaCredentialInput,
  removeTenantOpenWaCredential,
  upsertTenantOpenWaCredential,
} from "@/lib/integrations/whatsapp-bot/tenant-openwa-credential";
import { updateTenantFeatureConfiguration } from "@/lib/provider/provider-feature-data";
import {
  PROVIDER_FEATURES,
  type ProviderFeatureSelection,
} from "@/lib/provider/provider-feature-settings";

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

export type OpenWaCredentialState =
  | { status: "idle" }
  | { status: "saved" }
  | { status: "removed" }
  | { status: "error" };

export async function saveTenantOpenWaCredentialAction(
  tenantId: string,
  previousState: OpenWaCredentialState,
  formData: FormData,
): Promise<OpenWaCredentialState> {
  void previousState;
  await requireProviderActionAccess();
  const parsed = normalizeTenantOpenWaCredentialInput({
    apiBaseUrl: String(formData.get("apiBaseUrl") ?? ""),
    apiKey: String(formData.get("apiKey") ?? ""),
    sessionKey: String(formData.get("sessionKey") ?? ""),
  });
  if (!parsed.ok) return { status: "error" };
  try {
    await upsertTenantOpenWaCredential({ tenantId, ...parsed });
    revalidatePath("/provider/features");
    return { status: "saved" };
  } catch {
    return { status: "error" };
  }
}

export async function removeTenantOpenWaCredentialAction(
  tenantId: string,
  previousState: OpenWaCredentialState,
  _formData: FormData,
): Promise<OpenWaCredentialState> {
  void previousState;
  void _formData;
  await requireProviderActionAccess();
  try {
    await removeTenantOpenWaCredential(tenantId);
    revalidatePath("/provider/features");
    return { status: "removed" };
  } catch {
    return { status: "error" };
  }
}
