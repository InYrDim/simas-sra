import { SessionInfo } from "@/components/dashboard/session-info";
import { AdvancedAnalytics } from "@/components/dashboard/advanced-analytics";
import { MasterDataWarningBanner } from "@/components/dashboard/master-data-warning-banner";
import { NoTenantAccess } from "@/components/dashboard/no-tenant-access";
import { tenantMenuItems } from "@/components/tenant-nav-menu/config";
import { db } from "@/db";
import { tenant, studentProfile, schoolPerson } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { CalendarCheck, Clock, User } from "lucide-react";
import { listGerbangRecordsForDayWithStudents, listGerbangRecordsForStudent } from "@/lib/attendance/attendance-record-data";
import { localHHMMInZone, civilDateInZone } from "@/lib/attendance/attendance-date";
import { readTenantTimezone } from "@/lib/attendance/attendance-config";

import { OnboardingForm } from "@/app/(tenant)/[domain]/(authenticated)/dashboard/onboarding-form";

import { createHttpTenantAuthorizationEvaluator } from "@/lib/authorization/tenant-authorization-data";
import { resolveTenantHomeRoute } from "@/lib/authorization/tenant-home-route";
import { enforceAuthorizedTenantOperation } from "@/lib/authorization/tenant-operation-route-access";
import { getResolvedTenantFeatures } from "@/lib/features/tenant-feature-access-data";
import { readTenantMenuVisibility } from "@/lib/features/tenant-menu-visibility";

import { redirect } from "next/navigation";

/** Tailwind classes for an attendance status pill. */
function statusBadgeClass(status: string): string {
  switch (status) {
    case "masuk":
    case "hadir":
      return "bg-green-100 text-green-700";
    case "keluar":
      return "bg-blue-100 text-blue-700";
    case "izin":
      return "bg-amber-100 text-amber-700";
    case "sakit":
      return "bg-purple-100 text-purple-700";
    case "alpa":
      return "bg-red-100 text-red-700";
    default:
      return "bg-muted text-muted-foreground";
  }
}


export default async function DashboardPage({
  params,
}: {
  params: Promise<{ domain: string }>
}) {
  const { domain } = await params;
  const evaluator = await createHttpTenantAuthorizationEvaluator();
  const layoutDecision = await evaluator.evaluate({ surface: "page", domain, operationId: "authenticated.layout" });
  const layoutPrincipal = enforceAuthorizedTenantOperation(layoutDecision, { domain, operationId: "authenticated.layout" });

  const [tenantData] = await db
    .select()
    .from(tenant)
    .where(and(eq(tenant.id, layoutPrincipal.tenantId), eq(tenant.domain, domain)))
    .limit(1);
  if (!tenantData) throw new Error("Authorized Tenant disappeared during request");

  const features = await getResolvedTenantFeatures(tenantData.id);
  const homeRoute = resolveTenantHomeRoute(layoutPrincipal.permissions, tenantMenuItems, {
    features,
    onboardingCompleted: tenantData.onboardingCompletedAt !== null,
    menuVisibility: readTenantMenuVisibility(tenantData.settings),
  });
  if (homeRoute.kind === "no-access") {
    return <NoTenantAccess tenantName={tenantData.name ?? domain} />;
  }
  if (homeRoute.kind === "redirect") {
    redirect(`/${domain}${homeRoute.path}`);
  }

  const dashboardDecision = await evaluator.evaluate({ surface: "page", domain, operationId: "tenant.dashboard.load" });
  const principal = enforceAuthorizedTenantOperation(dashboardDecision, { domain, operationId: "tenant.dashboard.load" });

  const currentYear = new Date().getFullYear();
  const defaultSchoolYear = `${currentYear}/${currentYear + 1}`;
  const needsAdminOnboarding = tenantData.onboardingCompletedAt === null;
  const onboarding = needsAdminOnboarding
    ? await evaluator.evaluate({ surface: "page", domain, operationId: "tenant.onboarding.complete" })
    : null;

  // Student self-view: relevant content is their own absensi.
  const isStudent = Boolean(principal.selfPersonId);
  const timezone = readTenantTimezone(tenantData.settings);
  let studentName: string | null = null;
  let todayRecord: { status: string; recordedAt: Date; outOfSession: boolean } | null = null;
  let studentHistory: { id: string; status: string; recordedAt: Date; outOfSession: boolean }[] = [];
  if (isStudent) {
    const [profile] = await db
      .select({ id: studentProfile.id, fullName: schoolPerson.fullName })
      .from(studentProfile)
      .innerJoin(schoolPerson, eq(schoolPerson.id, studentProfile.personId))
      .where(and(eq(studentProfile.tenantId, tenantData.id), eq(studentProfile.personId, principal.selfPersonId!), eq(studentProfile.status, "active")))
      .limit(1);
    if (profile) {
      studentName = profile.fullName;
      const today = await listGerbangRecordsForDayWithStudents(tenantData.id, new Date(), timezone);
      todayRecord = today.find((r) => r.studentId === profile.id) ?? null;
      const todayCivil = civilDateInZone(new Date(), timezone);
      studentHistory = (await listGerbangRecordsForStudent(tenantData.id, profile.id, 30, timezone))
        .filter((r) => civilDateInZone(r.recordedAt, timezone) !== todayCivil)
        .map((r) => ({ id: r.id, status: r.status, recordedAt: r.recordedAt, outOfSession: r.outOfSession }));
    }
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Ringkasan</h2>
        {(() => {
          let trialStatusText = "Menunggu onboarding";
          if (tenantData.trialEndsAt) {
            const now = new Date();
            const isExpired = now > tenantData.trialEndsAt;
            const daysLeft = Math.ceil((tenantData.trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

            if (isExpired) {
              trialStatusText = "Trial berakhir";
            } else {
              trialStatusText = `Sisa Trial: ${daysLeft} hari`;
            }
          }
          return (
            <div className="text-sm font-medium text-muted-foreground bg-muted/50 px-3 py-1 rounded-full border border-border/50">
              {trialStatusText}
            </div>
          );
        })()}
      </div>

      <SessionInfo />

      <MasterDataWarningBanner tenantId={tenantData.id} domain={domain} />

      {needsAdminOnboarding && onboarding?.kind === "authorized" ? (
        <OnboardingForm domain={domain} defaultSchoolYear={defaultSchoolYear} />
      ) : null}

      {isStudent ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <User className="size-6" aria-hidden />
            </div>
            <div>
              <h3 className="text-xl font-semibold">{studentName ?? "Siswa"}</h3>
              <p className="text-sm text-muted-foreground">Ringkasan kehadiranmu</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <section className="rounded-2xl border bg-card text-card-foreground shadow-sm p-6">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="size-4" aria-hidden />
                <h3 className="text-sm font-medium">Absensi Hari Ini</h3>
              </div>
              {todayRecord ? (
                <div className="mt-4 flex items-center gap-3">
                  <span className={`rounded-full px-3 py-1 text-sm font-medium capitalize ${statusBadgeClass(todayRecord.status)}`}>
                    {todayRecord.status}
                  </span>
                  <span className="text-2xl font-semibold tabular-nums">{localHHMMInZone(todayRecord.recordedAt, timezone)}</span>
                </div>
              ) : (
                <p className="mt-4 text-muted-foreground">Belum ada absensi tercatat hari ini.</p>
              )}
            </section>

            <section className="rounded-2xl border bg-card text-card-foreground shadow-sm p-6">
              <div className="flex items-center gap-2 text-muted-foreground">
                <CalendarCheck className="size-4" aria-hidden />
                <h3 className="text-sm font-medium">Riwayat Absensi</h3>
              </div>
              {studentHistory.length > 0 ? (
                <ul className="mt-3 divide-y text-sm">
                  {studentHistory.map((record) => (
                    <li key={record.id} className="flex items-center justify-between gap-3 py-2">
                      <span className="font-medium">{civilDateInZone(record.recordedAt, timezone)}</span>
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${statusBadgeClass(record.status)}`}>{record.status}</span>
                        <span className="tabular-nums">{localHHMMInZone(record.recordedAt, timezone)}</span>
                        {record.outOfSession ? <span className="text-xs">· di luar sesi</span> : null}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-muted-foreground">Belum ada riwayat absensi.</p>
              )}
            </section>
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl border bg-card text-card-foreground shadow-sm p-6 flex flex-col gap-2 relative overflow-hidden group">
                <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="h-4 w-1/3 bg-muted rounded animate-pulse" />
                <div className="h-10 w-1/2 bg-muted rounded animate-pulse mt-2" />
              </div>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <AdvancedAnalytics tenantId={tenantData.id} />
            <div className="col-span-3 rounded-2xl border bg-card text-card-foreground shadow-sm p-6 h-[400px] flex flex-col gap-4">
              <div className="text-lg font-semibold">Aktivitas Terbaru</div>
              <div className="flex-1 space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="size-10 rounded-full bg-muted animate-pulse shrink-0" />
                    <div className="space-y-2 flex-1">
                      <div className="h-3 w-3/4 bg-muted rounded animate-pulse" />
                      <div className="h-3 w-1/2 bg-muted/50 rounded animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
