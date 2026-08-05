import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { applicant, providerAdmin, schoolAdminAuthority, simasApplication, temporaryCredentialActivation, tenant, tenantRole, tenantRoleAssignment, user } from "@/db/schema";
import { resolveCentralIdentity, type CentralIdentity } from "@/lib/platform/central-identity";

export async function getCentralIdentity(userId: string): Promise<CentralIdentity> {
  const [row] = await db
    .select({
      userId: user.id,
      tenantId: user.tenantId,
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
  const [authorities, activeRoleAssignments] = await Promise.all([
    db
      .select({
        id: schoolAdminAuthority.id,
        tenantId: schoolAdminAuthority.tenantId,
        userId: schoolAdminAuthority.userId,
        authorityState: schoolAdminAuthority.authorityState,
      })
      .from(schoolAdminAuthority)
      .where(eq(schoolAdminAuthority.userId, userId)),
    row.tenantId
      ? db
          .select({ id: tenantRoleAssignment.id })
          .from(tenantRoleAssignment)
          .innerJoin(tenantRole, and(
            eq(tenantRole.id, tenantRoleAssignment.roleId),
            eq(tenantRole.tenantId, tenantRoleAssignment.tenantId),
            eq(tenantRole.lifecycle, "active"),
          ))
          .where(and(
            eq(tenantRoleAssignment.userId, userId),
            eq(tenantRoleAssignment.tenantId, row.tenantId),
            eq(tenantRoleAssignment.state, "active"),
          ))
      : Promise.resolve([]),
  ]);
  const identity = resolveCentralIdentity({
    providerAdmin: row.providerAdminUserId !== null,
    applicant: row.applicantUserId !== null,
    tenantMembership: row.tenantId ? {
      userId: row.userId,
      tenantId: row.tenantId,
      domain: row.tenantDomain,
      activeRoleAssignmentIds: activeRoleAssignments.map((assignment) => assignment.id),
      schoolAdminAuthorities: authorities,
    } : null,
    activation: row.passwordChangeRequired === null ? null : { passwordChangeRequired: row.passwordChangeRequired },
    promotedApplicant: row.promotedOwnerUserId === row.userId,
  });
  if (identity.kind === "invalid") {
    console.error({ event: "central_identity_invalid", userId, reason: identity.reason });
  }
  return identity;
}
