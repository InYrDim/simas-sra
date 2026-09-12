"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { tenant } from "@/db/schema";
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
import {
  approveWhatsAppBotRequest,
  markWhatsAppBotRequestFulfilled,
  rejectWhatsAppBotRequest,
  type WhatsAppBotRequestDependencies,
} from "@/lib/integrations/whatsapp-bot/whatsapp-bot-request";
import {
  createWhatsAppBotRequest,
  readLatestWhatsAppBotRequest,
  readWhatsAppBotRequestById,
  updateWhatsAppBotRequest,
} from "@/lib/integrations/whatsapp-bot/whatsapp-bot-request-data";
import { readConnectionByTenantId } from "@/lib/integrations/whatsapp-bot/whatsapp-bot-data";

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

function requestDependencies(): WhatsAppBotRequestDependencies {
  return {
    readLatestRequest: readLatestWhatsAppBotRequest,
    readConnection: readConnectionByTenantId,
    createRequest: createWhatsAppBotRequest,
    readRequestById: readWhatsAppBotRequestById,
    updateRequest: updateWhatsAppBotRequest,
  };
}

async function revalidateTenantWhatsApp(requestId: string): Promise<void> {
  const request = await readWhatsAppBotRequestById(requestId);
  if (!request?.tenantId) return;
  const [row] = await db
    .select({ domain: tenant.domain })
    .from(tenant)
    .where(eq(tenant.id, request.tenantId))
    .limit(1);
  revalidatePath("/provider/features");
  if (row) revalidatePath(`/${row.domain}/integrasi/whatsapp`);
}

export type WhatsAppBotRequestReviewState =
  | { status: "idle" }
  | { status: "saved"; message: string }
  | { status: "error"; message: string };

export async function reviewWhatsAppBotRequestAction(
  requestId: string,
  _previousState: WhatsAppBotRequestReviewState,
  formData: FormData,
): Promise<WhatsAppBotRequestReviewState> {
  void _previousState;
  const { userId } = await requireProviderActionAccess();
  const decision = String(formData.get("decision") ?? "");
  const note = String(formData.get("note") ?? "").trim() || null;

  const result =
    decision === "reject"
      ? await rejectWhatsAppBotRequest(requestDependencies(), requestId, userId, note)
      : decision === "approve"
        ? await approveWhatsAppBotRequest(requestDependencies(), requestId, userId)
        : { ok: false as const, code: "not-found" as const };

  if (!result.ok) {
    if (result.code === "not-found") {
      return { status: "error", message: "Pengajuan tidak ditemukan." };
    }
    return { status: "error", message: "Pengajuan sudah selesai diproses." };
  }

  await revalidateTenantWhatsApp(requestId);
  return {
    status: "saved",
    message: decision === "reject" ? "Pengajuan ditolak." : "Pengajuan disetujui.",
  };
}

export type WhatsAppBotRequestFulfillState =
  | { status: "idle" }
  | { status: "saved" }
  | { status: "error" };

export async function fulfillWhatsAppBotRequestAction(
  requestId: string,
  previousState: WhatsAppBotRequestFulfillState,
  _formData: FormData,
): Promise<WhatsAppBotRequestFulfillState> {
  void previousState;
  void _formData;
  const { userId } = await requireProviderActionAccess();
  const result = await markWhatsAppBotRequestFulfilled(requestDependencies(), requestId, userId, "provider");
  await revalidateTenantWhatsApp(requestId);
  return result.ok ? { status: "saved" } : { status: "error" };
}
