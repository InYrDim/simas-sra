"use server";

import { revalidatePath } from "next/cache";

import {
  MAX_TENANT_LANDING_PAGE_HTML_LENGTH,
} from "@/lib/tenant-landing-page";
import { updateTenantLandingPage } from "@/lib/tenant-landing-page-data";
import { enforceMasterDataAccess } from "@/lib/tenant-master-data-route-access";

export type LandingPageActionState =
  | { status: "idle" }
  | { status: "saved" }
  | { status: "error"; message: string };

export async function updateLandingPageAction(
  domain: string,
  _previousState: LandingPageActionState,
  formData: FormData,
): Promise<LandingPageActionState> {
  const principal = await enforceMasterDataAccess(domain, "write");
  const html = String(formData.get("html") ?? "");
  if (html.length > MAX_TENANT_LANDING_PAGE_HTML_LENGTH) {
    return {
      status: "error",
      message: `HTML maksimal ${MAX_TENANT_LANDING_PAGE_HTML_LENGTH.toLocaleString("id-ID")} karakter.`,
    };
  }

  try {
    const updated = await updateTenantLandingPage(principal.tenantId, html);
    if (!updated) return { status: "error", message: "Tenant tidak ditemukan." };
    revalidatePath(`/${domain}`);
    revalidatePath(`/${domain}/settings`);
    return { status: "saved" };
  } catch (error) {
    console.error({ event: "tenant_landing_page_update_failed", tenantId: principal.tenantId, error });
    return { status: "error", message: "Landing page belum dapat disimpan. Coba lagi." };
  }
}
