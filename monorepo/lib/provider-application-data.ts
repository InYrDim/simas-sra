import "server-only";

import {
  and,
  asc,
  count,
  desc,
  eq,
  like,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import { db } from "@/db";
import { simasApplication, tenant, user } from "@/db/schema";
import {
  type ApplicationDecisionStore,
  type ApplicationStatus,
} from "@/lib/provider-applications";
import { requireProviderDataAccess } from "@/lib/provider-access";

export const APPLICATIONS_PER_PAGE = 10;

export type ApplicationListQuery = Readonly<{
  search?: string;
  status?: ApplicationStatus | "all";
  sort?: "newest" | "oldest" | "school-asc" | "school-desc";
  page?: number;
}>;

function listConditions(query: ApplicationListQuery): SQL[] {
  const conditions: SQL[] = [];
  const search = query.search?.trim();
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        like(simasApplication.schoolName, pattern),
        like(simasApplication.npsn, pattern),
        like(simasApplication.contactEmail, pattern),
        like(simasApplication.contactName, pattern),
      )!,
    );
  }
  if (query.status && query.status !== "all") {
    conditions.push(eq(simasApplication.status, query.status));
  }
  return conditions;
}

export async function listProviderApplications(query: ApplicationListQuery) {
  await requireProviderDataAccess();
  const page = Math.max(1, Number.isFinite(query.page) ? Math.floor(query.page!) : 1);
  const conditions = listConditions(query);
  const where = conditions.length ? and(...conditions) : undefined;
  const orderBy =
    query.sort === "oldest"
      ? asc(simasApplication.submittedAt)
      : query.sort === "school-asc"
        ? asc(simasApplication.schoolName)
        : query.sort === "school-desc"
          ? desc(simasApplication.schoolName)
          : desc(simasApplication.submittedAt);

  const [totalRow] = await db
    .select({ value: count() })
    .from(simasApplication)
    .where(where);
  const total = totalRow?.value ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / APPLICATIONS_PER_PAGE));
  const currentPage = Math.min(page, pageCount);
  const applications = await db
    .select()
    .from(simasApplication)
    .where(where)
    .orderBy(orderBy, desc(simasApplication.id))
    .limit(APPLICATIONS_PER_PAGE)
    .offset((currentPage - 1) * APPLICATIONS_PER_PAGE);

  return { applications, page: currentPage, pageCount, total };
}

export async function getProviderApplicationDetail(applicationId: string) {
  await requireProviderDataAccess();
  const [application] = await db
    .select()
    .from(simasApplication)
    .where(eq(simasApplication.id, applicationId))
    .limit(1);

  if (!application) return null;

  const [applicationConflicts, tenantConflicts, decisionMakers] = await Promise.all([
    db
      .select({
        id: simasApplication.id,
        schoolName: simasApplication.schoolName,
        npsn: simasApplication.npsn,
        contactEmail: simasApplication.contactEmail,
        status: simasApplication.status,
      })
      .from(simasApplication)
      .where(
        and(
          ne(simasApplication.id, application.id),
          or(
            eq(simasApplication.npsn, application.npsn),
            eq(simasApplication.contactEmail, application.contactEmail),
          ),
        ),
      )
      .orderBy(desc(simasApplication.submittedAt)),
    db
      .select({
        id: tenant.id,
        schoolName: tenant.name,
        npsn: tenant.npsn,
        contactEmail: sql<string | null>`max(case when ${user.email} = ${application.contactEmail} then ${user.email} else null end)`,
      })
      .from(tenant)
      .leftJoin(user, eq(user.tenantId, tenant.id))
      .where(
        or(
          eq(tenant.npsn, application.npsn),
          eq(user.email, application.contactEmail),
        ),
      )
      .groupBy(tenant.id, tenant.name, tenant.npsn),
    application.decidedByProviderAdminId
      ? db
          .select({ id: user.id, name: user.name, email: user.email })
          .from(user)
          .where(eq(user.id, application.decidedByProviderAdminId))
          .limit(1)
      : Promise.resolve([]),
  ]);

  return {
    application,
    applicationConflicts,
    tenantConflicts,
    decisionMaker: decisionMakers[0] ?? null,
  };
}

export const applicationDecisionStore: ApplicationDecisionStore = {
  transaction(work) {
    return db.transaction(async (tx) =>
      work({
        async lock(applicationId) {
          const [application] = await tx
            .select({ id: simasApplication.id, status: simasApplication.status })
            .from(simasApplication)
            .where(eq(simasApplication.id, applicationId))
            .limit(1)
            .for("update");
          return application ?? null;
        },
        async reject(decision) {
          await tx
            .update(simasApplication)
            .set({
              status: "rejected",
              decidedAt: decision.decidedAt,
              decidedByProviderAdminId: decision.providerAdminId,
              rejectionReason: decision.reason,
            })
            .where(
              and(
                eq(simasApplication.id, decision.applicationId),
                eq(simasApplication.status, "pending"),
              ),
            );
        },
      }),
    );
  },
};
