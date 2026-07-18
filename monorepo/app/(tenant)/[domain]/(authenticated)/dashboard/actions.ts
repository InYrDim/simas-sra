"use server";

import { tenantProtectedAction } from "@/lib/action-utils";

export const dummyUpdateSettings = tenantProtectedAction(async (formData: FormData) => {
  // In a real application, this would update database settings
  console.log("dummyUpdateSettings called with:", formData.get("setting"));
  
  // Return a simple success message
  return { success: true, message: "Pengaturan berhasil disimpan!" };
});
