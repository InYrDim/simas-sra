import { headers } from "next/headers";
import { db } from "@/db";
import { tenant } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function checkTrialStatus() {
  const headersList = await headers();
  const host = headersList.get("host") || "";
  const domain = host.split(".")[0];

  if (!domain) return true;

  const tenantDataArray = await db.select({ trialEndsAt: tenant.trialEndsAt }).from(tenant).where(eq(tenant.domain, domain)).limit(1);
  const tenantData = tenantDataArray[0];

  if (!tenantData || !tenantData.trialEndsAt) {
    return true; // No trial limit
  }

  const now = new Date();
  if (now > tenantData.trialEndsAt) {
    return false; // Expired
  }
  return true;
}

// Wrapper for Server Actions
export function tenantProtectedAction<T extends (...args: any[]) => Promise<any>>(action: T): T {
  return (async (...args: Parameters<T>) => {
    const isTrialActive = await checkTrialStatus();
    if (!isTrialActive) {
      throw new Error("Tindakan ini tidak diizinkan. Masa uji coba Anda telah berakhir. (Read-Only Mode)");
    }
    return action(...args);
  }) as T;
}
