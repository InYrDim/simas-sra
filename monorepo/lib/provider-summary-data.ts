import "server-only";

import { and, count, desc, eq, gt, isNull, lte } from "drizzle-orm";

import { db } from "@/db";
import { simasApplication, tenant } from "@/db/schema";
import { requireProviderDataAccess } from "@/lib/provider-access";
import { TENANT_ENDING_SOON_WINDOW_MS } from "@/lib/tenant-onboarding";

export const PROVIDER_SUMMARY_RECENT_LIMIT = 5;

export async function getProviderSummary(now: Date = new Date()) {
  await requireProviderDataAccess();

  const endingSoonAt = new Date(now.getTime() + TENANT_ENDING_SOON_WINDOW_MS);
  const [
    pendingApplicationsRow,
    providedTenantsRow,
    waitingForOnboardingRow,
    trialsEndingSoonRow,
    recentApplications,
    recentTenants,
  ] = await Promise.all([
    db
          .select({ count: count() })
          .from(simasApplication)
      .where(eq(simasApplication.status, "pending")),
    db.select({ count: count() }).from(tenant),
    db.select({ count: count() }).from(tenant).where(isNull(tenant.onboardingCompletedAt)),
    db
          .select({ count: count() })
          .from(tenant)
          .where(and(gt(tenant.trialEndsAt, now), lte(tenant.trialEndsAt, endingSoonAt))),
    db
      .select({
        id: simasApplication.id,
        schoolName: simasApplication.schoolName,
        status: simasApplication.status,
        submittedAt: simasApplication.submittedAt,
      })
      .from(simasApplication)
      .orderBy(desc(simasApplication.submittedAt), desc(simasApplication.id))
      .limit(PROVIDER_SUMMARY_RECENT_LIMIT),
    db
      .select({
        id: tenant.id,
        schoolName: tenant.name,
        domain: tenant.domain,
        approvedAt: tenant.approvedAt,
        createdAt: tenant.createdAt,
      })
      .from(tenant)
      .orderBy(desc(tenant.approvedAt), desc(tenant.createdAt), desc(tenant.id))
      .limit(PROVIDER_SUMMARY_RECENT_LIMIT),
  ]);

  return {
    counts: {
      pendingApplications: pendingApplicationsRow[0]?.count ?? 0,
            providedTenants: providedTenantsRow[0]?.count ?? 0,
            waitingForOnboarding: waitingForOnboardingRow[0]?.count ?? 0,
            trialsEndingSoon: trialsEndingSoonRow[0]?.count ?? 0,
    },
    recentApplications,
    recentTenants,
  };
}
