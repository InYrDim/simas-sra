"use server";

import { tenantProtectedAction } from "@/lib/action-utils";

export const dummyUpdateSettings = tenantProtectedAction(
  async (_domain: string, formData: FormData) => {
    const setting = formData.get("setting");

    if (typeof setting !== "string" || setting.trim() === "") {
      return { success: false, error: "Pengaturan wajib diisi." };
    }

    return { success: true, message: "Pengaturan berhasil disimpan!" };
  },
);
