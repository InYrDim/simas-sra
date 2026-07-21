import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { temporaryCredentialActivation, tenant, user } from "@/db/schema";
import type { TenantOnboardingStore } from "@/lib/tenant-onboarding";

export const tenantOnboardingStore: TenantOnboardingStore = {
  transaction(work) {
    return db.transaction((databaseTransaction) => work({
      async lockTenantForPrincipal(userId) {
        const [principal] = await databaseTransaction
          .select({
            tenantId: tenant.id,
            tenantRole: user.tenantRole,
            temporaryCredentialActivationUserId: temporaryCredentialActivation.userId,
            firstAuthenticatedAt: temporaryCredentialActivation.firstAuthenticatedAt,
            passwordChangeRequired: temporaryCredentialActivation.passwordChangeRequired,
            passwordChangedAt: temporaryCredentialActivation.passwordChangedAt,
            onboardingCompletedAt: tenant.onboardingCompletedAt,
            trialStartedAt: tenant.trialStartedAt,
            trialEndsAt: tenant.trialEndsAt,
          })
          .from(user)
          .leftJoin(
            temporaryCredentialActivation,
            and(
              eq(temporaryCredentialActivation.userId, user.id),
              eq(temporaryCredentialActivation.tenantId, user.tenantId),
            ),
          )
          .innerJoin(tenant, eq(tenant.id, user.tenantId))
          .where(eq(user.id, userId))
          .limit(1)
          .for("update");
        if (!principal || !principal.tenantRole) return null;
        return {
          ...principal,
          tenantRole: principal.tenantRole,
          hasTemporaryCredentialActivation: principal.temporaryCredentialActivationUserId !== null,
          passwordChangeRequired: principal.passwordChangeRequired ?? false,
        };
      },
      async complete(tenantId, settings, lifecycle) {
        const [current] = await databaseTransaction
          .select({ settings: tenant.settings })
          .from(tenant)
          .where(eq(tenant.id, tenantId))
          .limit(1);
        const existingSettings = current?.settings && typeof current.settings === "object"
          ? current.settings as Record<string, unknown>
          : {};

        await databaseTransaction
          .update(tenant)
          .set({ settings: { ...existingSettings, ...settings }, ...lifecycle })
          .where(eq(tenant.id, tenantId));
      },
    }));
  },
};
