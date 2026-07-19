import "server-only";

import { and, eq, isNull, ne } from "drizzle-orm";

import { db } from "@/db";
import { account, session, temporaryCredentialActivation, user } from "@/db/schema";
import type { TemporaryCredentialActivationStore } from "@/lib/temporary-credential-activation";

export const temporaryCredentialActivationStore: TemporaryCredentialActivationStore = {
  async recordFirstAuthentication(userId, authenticatedAt) {
    await db
      .update(temporaryCredentialActivation)
      .set({ firstAuthenticatedAt: authenticatedAt })
      .where(and(
        eq(temporaryCredentialActivation.userId, userId),
        isNull(temporaryCredentialActivation.firstAuthenticatedAt),
      ));
  },

  async getTenantPrincipal(userId) {
    const [principal] = await db
      .select({
        userId: user.id,
        tenantId: user.tenantId,
        tenantRole: user.tenantRole,
        passwordChangeRequired: temporaryCredentialActivation.passwordChangeRequired,
      })
      .from(user)
      .leftJoin(
        temporaryCredentialActivation,
        and(
          eq(temporaryCredentialActivation.userId, user.id),
          eq(temporaryCredentialActivation.tenantId, user.tenantId),
        ),
      )
      .where(eq(user.id, userId))
      .limit(1);

    if (!principal || !principal.tenantId || principal.tenantRole !== "school-admin") return null;
    return {
      userId: principal.userId,
      tenantId: principal.tenantId,
      tenantRole: "school-admin" as const,
      passwordChangeRequired: principal.passwordChangeRequired ?? false,
    };
  },

  transaction(work) {
    return db.transaction((databaseTransaction) => work({
      async lock(userId) {
        const [activation] = await databaseTransaction
          .select({
            userId: temporaryCredentialActivation.userId,
            firstAuthenticatedAt: temporaryCredentialActivation.firstAuthenticatedAt,
            passwordChangeRequired: temporaryCredentialActivation.passwordChangeRequired,
          })
          .from(temporaryCredentialActivation)
          .where(eq(temporaryCredentialActivation.userId, userId))
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
          .update(temporaryCredentialActivation)
          .set({ passwordChangeRequired: false, passwordChangedAt: changedAt })
          .where(and(
            eq(temporaryCredentialActivation.userId, userId),
            eq(temporaryCredentialActivation.passwordChangeRequired, true),
          ));
      },
      async reissueTemporaryCredential(userId, issuedAt) {
        await databaseTransaction
          .update(temporaryCredentialActivation)
          .set({ temporaryCredentialIssuedAt: issuedAt })
          .where(and(
            eq(temporaryCredentialActivation.userId, userId),
            isNull(temporaryCredentialActivation.firstAuthenticatedAt),
            eq(temporaryCredentialActivation.passwordChangeRequired, true),
          ));
      },
    }));
  },
};
