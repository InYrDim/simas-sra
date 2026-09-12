import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { schoolAdminAuthority, temporaryCredentialActivation, tenant, user } from "@/db/schema";
import type { TenantOnboardingStore } from "@/lib/tenancy/tenant-onboarding";

export const tenantOnboardingStore: TenantOnboardingStore = {
  transaction(work) {
    return db.transaction((databaseTransaction) => work({
      async lockTenantForPrincipal(userId) {
        const [principal] = await databaseTransaction
          .select({
            tenantId: tenant.id,
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
          .innerJoin(schoolAdminAuthority, and(
            eq(schoolAdminAuthority.userId, user.id),
            eq(schoolAdminAuthority.tenantId, tenant.id),
            eq(schoolAdminAuthority.authorityState, "active"),
          ))
          .where(eq(user.id, userId))
          .limit(1)
          .for("update");
        if (!principal) return null;
        return {
          ...principal,
          tenantRole: "school-admin" as const,
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
