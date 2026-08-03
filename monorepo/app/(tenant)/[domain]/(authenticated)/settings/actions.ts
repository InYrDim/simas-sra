"use server";

import { revalidatePath } from "next/cache";

import {
  MAX_TENANT_LANDING_PAGE_HTML_LENGTH,
} from "@/lib/tenancy/tenant-landing-page";
import { updateTenantLandingPage } from "@/lib/tenancy/tenant-landing-page-data";
import { createHttpTenantAuthorizationEvaluator } from "@/lib/authorization/tenant-authorization-data";
import { enforceAuthorizedTenantOperation } from "@/lib/authorization/tenant-operation-route-access";

export type LandingPageActionState =
  | { status: "idle" }
  | { status: "saved" }
  | { status: "error"; message: string };

export async function updateLandingPageAction(
  domain: string,
  _previousState: LandingPageActionState,
  formData: FormData,
): Promise<LandingPageActionState> {
  const evaluator = await createHttpTenantAuthorizationEvaluator();
  const decision = await evaluator.evaluate({ surface: "api", domain, operationId: "tenant-settings.landing-page.update" });
  const principal = enforceAuthorizedTenantOperation(decision, { domain, operationId: "tenant-settings.landing-page.update" });
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
