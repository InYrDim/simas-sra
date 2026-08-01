import { db } from "@/db";
import { schoolAdminAuthority, schoolAdminProof, user, providerAdmin, securityAuditEvent } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";

export async function getProviderSchoolAdminRoster(tenantId: string) {
  const authorities = await db.select({
    authorityId: schoolAdminAuthority.id,
    userId: schoolAdminAuthority.userId,
    state: schoolAdminAuthority.authorityState,
    createdAt: schoolAdminAuthority.createdAt,
    version: schoolAdminAuthority.version,
    userName: user.name,
    userEmail: user.email,
  })
  .from(schoolAdminAuthority)
  .innerJoin(user, and(eq(user.id, schoolAdminAuthority.userId), eq(user.tenantId, tenantId)))
  .where(eq(schoolAdminAuthority.tenantId, tenantId))
  .orderBy(desc(schoolAdminAuthority.createdAt));

  return authorities;
}
