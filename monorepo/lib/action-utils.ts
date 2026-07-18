import { db } from "@/db";
import { tenant } from "@/db/schema";
import { eq } from "drizzle-orm";

const READ_ONLY_MESSAGE =
  "Tindakan ini tidak diizinkan. Masa uji coba Anda telah berakhir (mode hanya-baca).";

type ProtectedActionError = {
  success: false;
  status: 403;
  error: string;
};

export async function isTenantWritable(
  domain: string,
  now: Date = new Date(),
): Promise<boolean> {
  const [tenantData] = await db
    .select({ trialEndsAt: tenant.trialEndsAt })
    .from(tenant)
    .where(eq(tenant.domain, domain))
    .limit(1);

  if (!tenantData) {
    return false;
  }

  return tenantData.trialEndsAt === null || now <= tenantData.trialEndsAt;
}

export function tenantProtectedAction<
  TArgs extends unknown[],
  TResult,
>(
  action: (domain: string, ...args: TArgs) => Promise<TResult>,
): (domain: string, ...args: TArgs) => Promise<TResult | ProtectedActionError> {
  return async (domain, ...args) => {
    if (!(await isTenantWritable(domain))) {
      return {
        success: false,
        status: 403,
        error: READ_ONLY_MESSAGE,
      };
    }

    return action(domain, ...args);
  };
}
