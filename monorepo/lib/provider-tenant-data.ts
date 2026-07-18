import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { schoolAdminActivation, tenant, user } from "@/db/schema";
import { requireProviderDataAccess } from "@/lib/provider-access";

export async function getProviderTenantActivation(tenantId: string) {
  await requireProviderDataAccess();
  const [result] = await db
    .select({
      tenantId: tenant.id,
      tenantName: tenant.name,
      domain: tenant.domain,
      onboardingCompletedAt: tenant.onboardingCompletedAt,
      trialStartedAt: tenant.trialStartedAt,
      schoolAdminUserId: user.id,
      schoolAdminEmail: user.email,
      firstAuthenticatedAt: schoolAdminActivation.firstAuthenticatedAt,
      passwordChangeRequired: schoolAdminActivation.passwordChangeRequired,
      temporaryCredentialIssuedAt: schoolAdminActivation.temporaryCredentialIssuedAt,
    })
    .from(tenant)
    .innerJoin(user, and(eq(user.tenantId, tenant.id), eq(user.tenantRole, "school-admin")))
    .innerJoin(schoolAdminActivation, eq(schoolAdminActivation.userId, user.id))
    .where(eq(tenant.id, tenantId))
    .limit(1);
  return result ?? null;
}
