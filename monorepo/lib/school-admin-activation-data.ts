import "server-only";

import { and, eq, isNull, ne } from "drizzle-orm";

import { db } from "@/db";
import { account, schoolAdminActivation, session, user } from "@/db/schema";
import type { SchoolAdminActivationStore } from "@/lib/school-admin-activation";

export const schoolAdminActivationStore: SchoolAdminActivationStore = {
  async recordFirstAuthentication(userId, authenticatedAt) {
    await db
      .update(schoolAdminActivation)
      .set({ firstAuthenticatedAt: authenticatedAt })
      .where(and(
        eq(schoolAdminActivation.userId, userId),
        isNull(schoolAdminActivation.firstAuthenticatedAt),
      ));
  },

  async getTenantPrincipal(userId) {
    const [principal] = await db
      .select({
        userId: user.id,
        tenantId: user.tenantId,
        tenantRole: user.tenantRole,
        passwordChangeRequired: schoolAdminActivation.passwordChangeRequired,
      })
      .from(user)
      .innerJoin(
        schoolAdminActivation,
        and(
          eq(schoolAdminActivation.userId, user.id),
          eq(schoolAdminActivation.tenantId, user.tenantId),
        ),
      )
      .where(eq(user.id, userId))
      .limit(1);

    if (!principal || !principal.tenantId || principal.tenantRole !== "school-admin") return null;
    return {
      userId: principal.userId,
      tenantId: principal.tenantId,
      tenantRole: "school-admin" as const,
      passwordChangeRequired: principal.passwordChangeRequired,
    };
  },

  transaction(work) {
    return db.transaction((databaseTransaction) => work({
      async lock(userId) {
        const [activation] = await databaseTransaction
          .select({
            userId: schoolAdminActivation.userId,
            firstAuthenticatedAt: schoolAdminActivation.firstAuthenticatedAt,
            passwordChangeRequired: schoolAdminActivation.passwordChangeRequired,
          })
          .from(schoolAdminActivation)
          .where(eq(schoolAdminActivation.userId, userId))
          .limit(1)
          .for("update");
        return activation ?? null;
      },
      async getCredentialHash(userId) {
        const [credential] = await databaseTransaction
          .select({ password: account.password })
          .from(account)
          .where(and(eq(account.userId, userId), eq(account.providerId, "credential")))
          .limit(1);
        return credential?.password ?? null;
      },
      async replaceCredential(userId, credentialHash) {
        await databaseTransaction
          .update(account)
          .set({ password: credentialHash })
          .where(and(eq(account.userId, userId), eq(account.providerId, "credential")));
      },
      async revokeOtherSessions(userId, currentSessionId) {
        await databaseTransaction
          .delete(session)
          .where(and(eq(session.userId, userId), ne(session.id, currentSessionId)));
      },
      async revokeAllSessions(userId) {
        await databaseTransaction.delete(session).where(eq(session.userId, userId));
      },
      async completePasswordChange(userId, changedAt) {
        await databaseTransaction
          .update(schoolAdminActivation)
          .set({ passwordChangeRequired: false, passwordChangedAt: changedAt })
          .where(and(
            eq(schoolAdminActivation.userId, userId),
            eq(schoolAdminActivation.passwordChangeRequired, true),
          ));
      },
      async reissueTemporaryCredential(userId, issuedAt) {
        await databaseTransaction
          .update(schoolAdminActivation)
          .set({ temporaryCredentialIssuedAt: issuedAt })
          .where(and(
            eq(schoolAdminActivation.userId, userId),
            isNull(schoolAdminActivation.firstAuthenticatedAt),
            eq(schoolAdminActivation.passwordChangeRequired, true),
          ));
      },
    }));
  },
};
