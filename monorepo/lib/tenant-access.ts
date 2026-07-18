import "server-only";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";

import { db } from "@/db";
import { tenant } from "@/db/schema";
import { auth } from "@/lib/auth";
import { requireActivatedTenantPrincipal, TenantActivationError } from "@/lib/school-admin-activation";
import { schoolAdminActivationStore } from "@/lib/school-admin-activation-data";

export async function requireTenantFeatureAccess(domain: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new TenantActivationError("forbidden");

  const [tenantData] = await db
    .select({ id: tenant.id })
    .from(tenant)
    .where(eq(tenant.domain, domain))
    .limit(1);
  if (!tenantData) throw new TenantActivationError("forbidden");

  return requireActivatedTenantPrincipal(
    session.user.id,
    tenantData.id,
    schoolAdminActivationStore,
  );
}
