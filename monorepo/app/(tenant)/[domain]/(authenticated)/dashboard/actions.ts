"use server";

import { revalidatePath } from "next/cache";

import { tenantProtectedAction } from "@/lib/action-utils";
import { requireTenantFeatureAccess } from "@/lib/tenant-access";
import { TenantOnboardingError } from "@/lib/tenant-onboarding";
import { completeTenantOnboarding } from "@/lib/tenant-onboarding-server";

export type OnboardingActionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "completed" };

export async function completeOnboardingAction(
  domain: string,
  _previousState: OnboardingActionState,
  formData: FormData,
): Promise<OnboardingActionState> {
  await requireTenantFeatureAccess(domain);

  try {
    await completeTenantOnboarding({
      schoolYear: String(formData.get("schoolYear") ?? ""),
      timezone: String(formData.get("timezone") ?? ""),
    });
  } catch (error) {
    if (!(error instanceof TenantOnboardingError)) throw error;

    const message = error.code === "password-change-required"
      ? "Ganti kata sandi sementara terlebih dahulu sebelum melanjutkan onboarding."
      : error.code === "invalid-configuration"
        ? "Tahun ajaran dan zona waktu wajib diisi dengan nilai yang valid."
        : "Anda tidak memiliki akses untuk menyelesaikan onboarding tenant ini.";
    return { status: "error", message };
  }

  revalidatePath(`/${domain}/dashboard`);
  return { status: "completed" };
}

export const dummyUpdateSettings = tenantProtectedAction(
  async (_domain: string, formData: FormData) => {
    const setting = formData.get("setting");

    if (typeof setting !== "string" || setting.trim() === "") {
      return { success: false, error: "Pengaturan wajib diisi." };
    }

    return { success: true, message: "Pengaturan berhasil disimpan!" };
  },
);
