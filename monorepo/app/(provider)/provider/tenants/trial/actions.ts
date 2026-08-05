"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { tenant } from "@/db/schema";
import { requireProviderDataAccess } from "@/lib/provider/provider-access";

export async function updateTrialDurationAction(tenantId: string, formData: FormData) {
  await requireProviderDataAccess();
  
  const additionalDaysStr = formData.get("additionalDays") as string;
  const newEndDateStr = formData.get("newEndDate") as string;
  
  if (!additionalDaysStr && !newEndDateStr) {
    return { success: false, error: "Silakan pilih hari tambahan atau tanggal berakhir." };
  }
  
  try {
    const [existingTenant] = await db.select({ trialEndsAt: tenant.trialEndsAt }).from(tenant).where(eq(tenant.id, tenantId)).limit(1);
    
    if (!existingTenant) {
      return { success: false, error: "Tenant tidak ditemukan." };
    }
    
    let newTrialEndsAt = new Date();
    
    if (additionalDaysStr) {
      const days = parseInt(additionalDaysStr, 10);
      if (isNaN(days) || days <= 0) {
        return { success: false, error: "Jumlah hari tidak valid." };
      }
      const baseDate = existingTenant.trialEndsAt && existingTenant.trialEndsAt > new Date() 
        ? existingTenant.trialEndsAt 
        : new Date();
      newTrialEndsAt = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);
    } else if (newEndDateStr) {
      newTrialEndsAt = new Date(newEndDateStr);
      newTrialEndsAt.setHours(23, 59, 59, 999);
    }
    
    await db.update(tenant).set({ trialEndsAt: newTrialEndsAt }).where(eq(tenant.id, tenantId));
    
    revalidatePath("/provider/tenants/trial");
    return { success: true, message: "Durasi trial berhasil diperbarui!" };
  } catch (error) {
    console.error("updateTrialDurationAction error:", error);
    return { success: false, error: "Terjadi kesalahan saat memperbarui durasi trial: " + (error instanceof Error ? error.message : String(error)) };
  }
}

export async function terminateTrialAction(tenantId: string) {
  await requireProviderDataAccess();
  
  try {
    const [existingTenant] = await db.select({ trialEndsAt: tenant.trialEndsAt }).from(tenant).where(eq(tenant.id, tenantId)).limit(1);
    
    if (!existingTenant) {
      return { success: false, error: "Tenant tidak ditemukan." };
    }
    
    // Matikan trial dengan mengatur trialEndsAt ke hari ini (saat ini)
    const newTrialEndsAt = new Date();
    
    await db.update(tenant).set({ trialEndsAt: newTrialEndsAt }).where(eq(tenant.id, tenantId));
    
    revalidatePath("/provider/tenants/trial");
    return { success: true, message: "Trial berhasil dimatikan!" };
  } catch (error) {
    console.error("terminateTrialAction error:", error);
    return { success: false, error: "Terjadi kesalahan saat mematikan trial: " + (error instanceof Error ? error.message : String(error)) };
  }
}
