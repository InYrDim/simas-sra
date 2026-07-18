import { AlertTriangle, Info } from "lucide-react";
import { db } from "@/db";
import { tenant } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function TrialBanner({ domain }: { domain: string }) {
  const tenantDataArray = await db.select({ trialEndsAt: tenant.trialEndsAt }).from(tenant).where(eq(tenant.domain, domain)).limit(1);
  const tenantData = tenantDataArray[0];

  if (!tenantData || !tenantData.trialEndsAt) {
    return null;
  }

  const now = new Date();
  const isExpired = now > tenantData.trialEndsAt;
  const daysLeft = Math.ceil((tenantData.trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (isExpired) {
    return (
      <div className="bg-destructive/15 border-b border-destructive text-destructive px-4 py-2 flex items-center justify-center text-sm font-medium">
        <AlertTriangle className="h-4 w-4 mr-2" />
        Masa uji coba (trial) Anda telah berakhir. Silakan hubungi provider untuk memperpanjang langganan Anda.
      </div>
    );
  }

  if (daysLeft <= 7) {
    return (
      <div className="bg-amber-500/15 border-b border-amber-500 text-amber-700 dark:text-amber-400 px-4 py-2 flex items-center justify-center text-sm font-medium">
        <Info className="h-4 w-4 mr-2" />
        Masa uji coba Anda tersisa {daysLeft} hari lagi.
      </div>
    );
  }

  return null;
}
