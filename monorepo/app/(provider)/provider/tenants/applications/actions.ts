"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { applicationDecisionStore } from "@/lib/provider-application-data";
import { createRejectSimasApplicationCommand } from "@/lib/provider-applications";
import { requireProviderActionAccess } from "@/lib/provider-access";

export async function rejectSimasApplicationAction(
  applicationId: string,
  formData: FormData,
) {
  const principal = await requireProviderActionAccess();
  const reject = createRejectSimasApplicationCommand({
    authorize: async () => principal,
    store: applicationDecisionStore,
  });
  const result = await reject({
    applicationId,
    reason: formData.get("reason"),
  });
  const detailPath = `/provider/tenants/applications/${applicationId}`;

  if (!result.ok) {
    const message =
      result.code === "invalid-input"
        ? result.errors.reason ?? result.errors.applicationId ?? "Input tidak valid."
        : result.code === "not-found"
          ? "Pengajuan SIMAS tidak ditemukan."
          : "Pengajuan SIMAS ini sudah memiliki keputusan dan tidak dapat diubah.";
    redirect(`${detailPath}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/provider/tenants");
  revalidatePath(detailPath);
  redirect(`${detailPath}?success=rejected`);
}
