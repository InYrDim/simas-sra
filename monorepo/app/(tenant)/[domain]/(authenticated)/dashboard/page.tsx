import { SessionInfo } from "@/components/dashboard/session-info";
import { AdvancedAnalytics } from "@/components/dashboard/advanced-analytics";
import { MasterDataWarningBanner } from "@/components/dashboard/master-data-warning-banner";
import { NoTenantAccess } from "@/components/dashboard/no-tenant-access";
import { tenantMenuItems } from "@/components/tenant-nav-menu/config";
import { db } from "@/db";
import { tenant } from "@/db/schema";
import { and, eq } from "drizzle-orm";

import { OnboardingForm } from "@/app/(tenant)/[domain]/(authenticated)/dashboard/onboarding-form";

import { createHttpTenantAuthorizationEvaluator } from "@/lib/authorization/tenant-authorization-data";
import { resolveTenantHomeRoute } from "@/lib/authorization/tenant-home-route";
import { enforceAuthorizedTenantOperation } from "@/lib/authorization/tenant-operation-route-access";
import { getResolvedTenantFeatures } from "@/lib/features/tenant-feature-access-data";

import { redirect } from "next/navigation";


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
    </div>
  )
}
