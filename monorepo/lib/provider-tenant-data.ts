import "server-only";

import { and, asc, count, desc, eq, or, sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { temporaryCredentialActivation, simasApplication, tenant, user } from "@/db/schema";
import { requireProviderDataAccess } from "@/lib/provider-access";
import { literalLikePattern, type TenantListQuery } from "@/lib/provider-tenants";
import { TENANT_ENDING_SOON_WINDOW_MS } from "@/lib/tenant-onboarding";

export const TENANTS_PER_PAGE = 10;

function tenantListConditions(query: TenantListQuery, now: Date): SQL[] {
  const conditions: SQL[] = [];
  if (query.search) {
    const pattern = literalLikePattern(query.search);
    conditions.push(or(
      sql`${tenant.name} like ${pattern} escape '='`,
      sql`${tenant.npsn} like ${pattern} escape '='`,
      sql`${tenant.domain} like ${pattern} escape '='`,
      sql`${user.email} like ${pattern} escape '='`,
    )!);
  }

  const endingSoonAt = new Date(now.getTime() + TENANT_ENDING_SOON_WINDOW_MS);
  if (query.stage === "waiting-for-onboarding") {
    conditions.push(sql`${tenant.onboardingCompletedAt} is null`);
  } else if (query.stage === "in-trial") {
    conditions.push(sql`${tenant.onboardingCompletedAt} is not null and ${tenant.trialEndsAt} > ${endingSoonAt}`);
  } else if (query.stage === "ending-soon") {
    conditions.push(sql`${tenant.trialEndsAt} > ${now} and ${tenant.trialEndsAt} <= ${endingSoonAt}`);
  } else if (query.stage === "expired") {
    conditions.push(sql`${tenant.trialEndsAt} <= ${now}`);
  }
  return conditions;
}

export async function listProviderTenants(query: TenantListQuery, now: Date = new Date()) {
  await requireProviderDataAccess();
  const conditions = tenantListConditions(query, now);
  const where = conditions.length ? and(...conditions) : undefined;
  const orderBy = query.sort === "oldest"
    ? asc(tenant.approvedAt)
    : query.sort === "school-asc"
      ? asc(tenant.name)
      : query.sort === "school-desc"
        ? desc(tenant.name)
        : desc(tenant.approvedAt);

  const baseJoin = db
    .select({ value: count() })
    .from(tenant)
    .innerJoin(user, and(eq(user.tenantId, tenant.id), eq(user.tenantRole, "school-admin")));
  const [totalRow] = await baseJoin.where(where);
  const total = totalRow?.value ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / TENANTS_PER_PAGE));
  const page = Math.min(query.page, pageCount);
  const tenants = await db
    .select({
      id: tenant.id,
      schoolName: tenant.name,
      npsn: tenant.npsn,
      domain: tenant.domain,
      schoolAdminEmail: user.email,
      approvedAt: tenant.approvedAt,
      onboardingCompletedAt: tenant.onboardingCompletedAt,
      trialEndsAt: tenant.trialEndsAt,
    })
    .from(tenant)
    .innerJoin(user, and(eq(user.tenantId, tenant.id), eq(user.tenantRole, "school-admin")))
    .where(where)
    .orderBy(orderBy, desc(tenant.id))
    .limit(TENANTS_PER_PAGE)
    .offset((page - 1) * TENANTS_PER_PAGE);

  return { tenants, page, pageCount, total };
}

export async function getProviderTenantDetail(tenantId: string) {
  await requireProviderDataAccess();
  const [result] = await db
    .select({
      tenantId: tenant.id,
      tenantName: tenant.name,
      npsn: tenant.npsn,
      domain: tenant.domain,
      approvedAt: tenant.approvedAt,
      onboardingCompletedAt: tenant.onboardingCompletedAt,
      trialStartedAt: tenant.trialStartedAt,
      trialEndsAt: tenant.trialEndsAt,
      schoolAdminUserId: user.id,
      schoolAdminName: user.name,
      schoolAdminEmail: user.email,
      schoolAdminEmailVerified: user.emailVerified,
      temporaryCredentialActivationUserId: temporaryCredentialActivation.userId,
      firstAuthenticatedAt: temporaryCredentialActivation.firstAuthenticatedAt,
      passwordChangeRequired: temporaryCredentialActivation.passwordChangeRequired,
      temporaryCredentialIssuedAt: temporaryCredentialActivation.temporaryCredentialIssuedAt,
      applicationId: simasApplication.id,
      applicationSchoolName: simasApplication.schoolName,
      applicationNpsn: simasApplication.npsn,
      applicationEducationLevel: simasApplication.educationLevel,
      applicationAddress: simasApplication.address,
      applicationContactName: simasApplication.contactName,
      applicationContactPosition: simasApplication.contactPosition,
      applicationContactEmail: simasApplication.contactEmail,
      applicationContactWhatsapp: simasApplication.contactWhatsapp,
      applicationNeedsNote: simasApplication.needsNote,
      applicationSubmittedAt: simasApplication.submittedAt,
    })
    .from(tenant)
    .innerJoin(user, and(eq(user.tenantId, tenant.id), eq(user.tenantRole, "school-admin")))
    .leftJoin(
      temporaryCredentialActivation,
      and(
        eq(temporaryCredentialActivation.userId, user.id),
        eq(temporaryCredentialActivation.tenantId, tenant.id),
      ),
    )
    .leftJoin(simasApplication, eq(simasApplication.id, tenant.sourceApplicationId))
    .where(eq(tenant.id, tenantId))
    .limit(1);
  return result ?? null;
}
