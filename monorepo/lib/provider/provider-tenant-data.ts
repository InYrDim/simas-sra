import "server-only";

import { and, asc, count, desc, eq, inArray, isNull, or, sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { schoolAdminAuthority, temporaryCredentialActivation, simasApplication, tenant, tenantAccountSecurity, user } from "@/db/schema";
import { requireProviderDataAccess } from "@/lib/provider/provider-access";
import { literalLikePattern, projectProviderSchoolAdminRoster, type TenantListQuery } from "@/lib/provider/provider-tenants";
import { TENANT_ENDING_SOON_WINDOW_MS } from "@/lib/tenancy/tenant-onboarding";

export const TENANTS_PER_PAGE = 10;

function tenantListConditions(query: TenantListQuery, now: Date): SQL[] {
  const conditions: SQL[] = [];
  if (query.search) {
    const pattern = literalLikePattern(query.search);
    conditions.push(or(
      sql`${tenant.name} like ${pattern} escape '='`,
      sql`${tenant.npsn} like ${pattern} escape '='`,
      sql`${tenant.domain} like ${pattern} escape '='`,
      sql`exists (
        select 1 from ${schoolAdminAuthority} authority
        inner join ${user} admin_user
          on admin_user.id = authority.user_id
          and admin_user.tenant_id = authority.tenant_id
          and admin_user.tenant_role = 'school-admin'
        left join ${tenantAccountSecurity} account_security
          on account_security.user_id = admin_user.id
          and account_security.tenant_id = authority.tenant_id
        where authority.tenant_id = ${tenant.id}
          and authority.authority_state = 'active'
          and (account_security.lifecycle is null or account_security.lifecycle = 'active')
          and admin_user.email like ${pattern} escape '='
      )`,
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

  const [totalRow] = await db.select({ value: count() }).from(tenant).where(where);
  const total = totalRow?.value ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / TENANTS_PER_PAGE));
  const page = Math.min(query.page, pageCount);
  const tenantRows = await db
    .select({
      id: tenant.id,
      schoolName: tenant.name,
      npsn: tenant.npsn,
      domain: tenant.domain,
      approvedAt: tenant.approvedAt,
      onboardingCompletedAt: tenant.onboardingCompletedAt,
      trialEndsAt: tenant.trialEndsAt,
    })
    .from(tenant)
    .where(where)
    .orderBy(orderBy, desc(tenant.id))
    .limit(TENANTS_PER_PAGE)
    .offset((page - 1) * TENANTS_PER_PAGE);
  const rosterRows = tenantRows.length === 0 ? [] : await db
    .select({ tenantId: schoolAdminAuthority.tenantId, userId: user.id, email: user.email })
    .from(schoolAdminAuthority)
    .innerJoin(user, and(
      eq(user.id, schoolAdminAuthority.userId),
      eq(user.tenantId, schoolAdminAuthority.tenantId),
      eq(user.tenantRole, "school-admin"),
    ))
    .leftJoin(tenantAccountSecurity, and(
      eq(tenantAccountSecurity.userId, user.id),
      eq(tenantAccountSecurity.tenantId, schoolAdminAuthority.tenantId),
    ))
    .where(and(
      inArray(schoolAdminAuthority.tenantId, tenantRows.map((row) => row.id)),
      eq(schoolAdminAuthority.authorityState, "active"),
      or(isNull(tenantAccountSecurity.lifecycle), eq(tenantAccountSecurity.lifecycle, "active")),
    ))
    .orderBy(schoolAdminAuthority.tenantId, user.email, user.id);
  const rosters = new Map<string, Array<{ userId: string; email: string }>>();
  for (const row of rosterRows) {
    const roster = rosters.get(row.tenantId) ?? [];
    roster.push({ userId: row.userId, email: row.email });
    rosters.set(row.tenantId, roster);
  }
  const tenants = tenantRows.map((row) => {
    const schoolAdmins = rosters.get(row.id) ?? [];
    return {
      ...row,
      schoolAdmins,
      schoolAdminCount: schoolAdmins.length,
      schoolAdminEmail: schoolAdmins[0]?.email ?? "—",
    };
  });

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
    .leftJoin(simasApplication, eq(simasApplication.id, tenant.sourceApplicationId))
    .where(eq(tenant.id, tenantId))
    .limit(1);
  if (!result) return null;

  const schoolAdmins = await db
    .select({
      authorityId: schoolAdminAuthority.id,
      authorityVersion: schoolAdminAuthority.version,
      authorityState: schoolAdminAuthority.authorityState,
      legacyRole: user.tenantRole,
      accountLifecycle: tenantAccountSecurity.lifecycle,
      schoolAdminUserId: user.id,
      schoolAdminName: user.name,
      schoolAdminEmail: user.email,
      schoolAdminEmailVerified: user.emailVerified,
      temporaryCredentialActivationUserId: temporaryCredentialActivation.userId,
      firstAuthenticatedAt: temporaryCredentialActivation.firstAuthenticatedAt,
      passwordChangeRequired: temporaryCredentialActivation.passwordChangeRequired,
      temporaryCredentialIssuedAt: temporaryCredentialActivation.temporaryCredentialIssuedAt,
    })
    .from(schoolAdminAuthority)
    .innerJoin(user, and(
      eq(user.id, schoolAdminAuthority.userId),
      eq(user.tenantId, schoolAdminAuthority.tenantId),
    ))
    .leftJoin(tenantAccountSecurity, and(
      eq(tenantAccountSecurity.userId, user.id),
      eq(tenantAccountSecurity.tenantId, schoolAdminAuthority.tenantId),
    ))
    .leftJoin(temporaryCredentialActivation, and(
      eq(temporaryCredentialActivation.userId, user.id),
      eq(temporaryCredentialActivation.tenantId, schoolAdminAuthority.tenantId),
    ))
    .where(eq(schoolAdminAuthority.tenantId, tenantId))
    .orderBy(user.email, user.id);
  const roster = projectProviderSchoolAdminRoster(schoolAdmins);
  const first = roster.activeSchoolAdmins[0] ?? null;
  return {
    ...result,
    schoolAdmins: roster.schoolAdmins,
    activeSchoolAdminCount: roster.activeSchoolAdminCount,
    schoolAdminCoverage: roster.coverage,
    schoolAdminUserId: first?.schoolAdminUserId ?? null,
    schoolAdminName: first?.schoolAdminName ?? null,
    schoolAdminEmail: first?.schoolAdminEmail ?? null,
    schoolAdminEmailVerified: first?.schoolAdminEmailVerified ?? false,
    temporaryCredentialActivationUserId: first?.temporaryCredentialActivationUserId ?? null,
    firstAuthenticatedAt: first?.firstAuthenticatedAt ?? null,
    passwordChangeRequired: first?.passwordChangeRequired ?? null,
    temporaryCredentialIssuedAt: first?.temporaryCredentialIssuedAt ?? null,
  };
}
