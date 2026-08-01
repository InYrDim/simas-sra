import { db } from "@/db";
import { schoolAdminAuthority, schoolAdminProof, user, providerAdmin, securityAuditEvent } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { randomUUID } from "node:crypto";

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

export async function nominateProviderSchoolAdmin(tenantId: string, email: string, name: string) {
  // Simplified mock implementation for the UI
  const userId = randomUUID();
  const authorityId = randomUUID();
  
  await db.transaction(async (tx) => {
    await tx.insert(user).values({
      id: userId,
      tenantId: tenantId,
      name,
      email,
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    
    await tx.insert(schoolAdminAuthority).values({
      id: authorityId,
      tenantId: tenantId,
      userId: userId,
      authorityState: 'pending-proof',
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
    });
  });
}
