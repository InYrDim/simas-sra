"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  applicationApprovalStore,
  applicationDecisionStore,
} from "@/lib/provider-application-data";
import {
  createApproveSimasApplicationCommand,
  createRejectSimasApplicationCommand,
} from "@/lib/provider-applications";
import { requireProviderActionAccess } from "@/lib/provider-access";

export type ApprovalActionState =
  | { status: "idle" }
  | { status: "error"; message: string; subdomain?: string }
  | { status: "already-approved"; tenantId: string }
  | {
      status: "approved";
      tenantId: string;
      schoolAdminEmail: string;
      temporaryCredential: string;
    };

const CONFLICT_MESSAGES = {
  npsn: "NPSN sudah digunakan Tenant lain.",
  subdomain: "Subdomain sudah digunakan Tenant lain.",
  email: "Email School Admin sudah digunakan.",
  concurrent: "Persetujuan bertabrakan dengan perubahan lain. Muat ulang halaman dan coba lagi.",
} as const;

export async function approveSimasApplicationAction(
  applicationId: string,
  _previousState: ApprovalActionState,
  formData: FormData,
): Promise<ApprovalActionState> {
  const principal = await requireProviderActionAccess();
  const approve = createApproveSimasApplicationCommand({
    authorize: async () => principal,
    store: applicationApprovalStore,
  });
  const subdomain = formData.get("subdomain");
  const result = await approve({ applicationId, subdomain });

  if (!result.ok) {
    const message =
      result.code === "invalid-input"
        ? result.errors.subdomain ?? result.errors.applicationId ?? "Input tidak valid."
        : result.code === "not-found"
          ? "Pengajuan SIMAS tidak ditemukan."
          : result.code === "decision-conflict"
            ? "Pengajuan SIMAS yang ditolak tidak dapat disetujui."
            : CONFLICT_MESSAGES[result.field];
    return {
      status: "error",
      message,
      subdomain: typeof subdomain === "string" ? subdomain : undefined,
    };
  }

  revalidatePath("/provider/tenants");
  revalidatePath(`/provider/tenants/applications/${applicationId}`);
  if (result.status === "already-approved") {
    return { status: "already-approved", tenantId: result.tenantId };
  }
  return {
    status: "approved",
    tenantId: result.tenantId,
    schoolAdminEmail: result.schoolAdminEmail,
    temporaryCredential: result.temporaryCredential,
  };
}

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
