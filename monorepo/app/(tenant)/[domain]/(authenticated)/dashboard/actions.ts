"use server";

import { revalidatePath } from "next/cache";

import { tenantProtectedAction } from "@/lib/platform/action-utils";
import { requireTenantFeatureAccess } from "@/lib/tenancy/tenant-access";
import { TenantOnboardingError } from "@/lib/tenancy/tenant-onboarding";
import { completeTenantOnboarding } from "@/lib/tenancy/tenant-onboarding-server";

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
    const schoolYearInput = String(formData.get("schoolYear") ?? "");
    await completeTenantOnboarding({
      schoolYear: schoolYearInput,
      timezone: String(formData.get("timezone") ?? ""),
    });

    const startYear = Number(schoolYearInput.split("/")[0]);
    if (Number.isInteger(startYear)) {
      const endYear = startYear + 1;
      const { createAcademicYearService } = await import("@/lib/academic/academic-year");
      const { academicYearStore } = await import("@/lib/academic/academic-year-data");
      const { enforceAcademicAccess } = await import("@/lib/master-data/tenant-master-data-route-access");
      const principal = await enforceAcademicAccess(domain, "academic-years.create");
      const service = createAcademicYearService({ store: academicYearStore });
      await service.create(principal, {
        label: `${startYear}/${endYear}`,
        startDate: `${startYear}-07-01`,
        endDate: `${endYear}-06-30`,
        oddStartDate: `${startYear}-07-01`,
        oddEndDate: `${startYear}-12-31`,
        evenStartDate: `${endYear}-01-01`,
        evenEndDate: `${endYear}-06-30`,
      });
    }
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
