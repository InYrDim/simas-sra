import { eq } from "drizzle-orm";

import { db } from "@/db";
import { applicant, providerAdmin, simasApplication, temporaryCredentialActivation, tenant, user } from "@/db/schema";
import { resolveCentralIdentity, type CentralIdentity } from "@/lib/central-identity";

export async function getCentralIdentity(userId: string): Promise<CentralIdentity> {
  const [row] = await db
    .select({
      userId: user.id,
      tenantId: user.tenantId,
      tenantRole: user.tenantRole,
      tenantDomain: tenant.domain,
      providerAdminUserId: providerAdmin.userId,
      applicantUserId: applicant.userId,
      passwordChangeRequired: temporaryCredentialActivation.passwordChangeRequired,
      promotedOwnerUserId: simasApplication.ownerUserId,
    })
    .from(user)
    .leftJoin(providerAdmin, eq(providerAdmin.userId, user.id))
    .leftJoin(applicant, eq(applicant.userId, user.id))
    .leftJoin(tenant, eq(tenant.id, user.tenantId))
    .leftJoin(simasApplication, eq(simasApplication.id, tenant.sourceApplicationId))
    .leftJoin(temporaryCredentialActivation, eq(temporaryCredentialActivation.userId, user.id))
    .where(eq(user.id, userId))
    .limit(1);

  if (!row) return { kind: "invalid", reason: "no-identity-path" };
  const identity = resolveCentralIdentity({
    providerAdmin: row.providerAdminUserId !== null,
    applicant: row.applicantUserId !== null,
    tenantMembership: row.tenantId ? { tenantId: row.tenantId, domain: row.tenantDomain, role: row.tenantRole } : null,
    activation: row.passwordChangeRequired === null ? null : { passwordChangeRequired: row.passwordChangeRequired },
    promotedApplicant: row.promotedOwnerUserId === row.userId,
  });
  if (identity.kind === "invalid") {
    console.error({ event: "central_identity_invalid", userId, reason: identity.reason });
  }
  return identity;
}
