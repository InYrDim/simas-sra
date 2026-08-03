import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { TenantSidebar } from "@/components/dashboard/tenant-sidebar";
import { TrialBanner } from "@/components/dashboard/trial-banner";
import { MasterDataAccessBlocked } from "@/components/dashboard/master-data-access-blocked";
import { db } from "@/db";
import { tenant as tenantTable } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

import {
  getMasterDataGatedArea,
  getMissingUrgentMasterData,
  getTenantRelativePath,
} from "@/lib/master-data/dashboard-master-data";
import { getUrgentMasterDataPresence } from "@/lib/master-data/dashboard-master-data-data";
import { getResolvedTenantFeatures } from "@/lib/features/tenant-feature-access-data";
import { createHttpTenantAuthorizationEvaluator } from "@/lib/authorization/tenant-authorization-data";
import { enforceAuthorizedTenantOperation } from "@/lib/authorization/tenant-operation-route-access";
import { TENANT_PATHNAME_HEADER } from "@/lib/platform/proxy-routing";

import { headers } from "next/headers";


export default async function DashboardLayout({ children, params }: {
  children: React.ReactNode;
  params: Promise<{ domain: string }>;
}) {
  const { domain } = await params;
  const requestHeaders = await headers();
  const evaluator = await createHttpTenantAuthorizationEvaluator();
  const layoutDecision = await evaluator.evaluate({ surface: "page", domain, operationId: "authenticated.layout" });
  const principal = enforceAuthorizedTenantOperation(layoutDecision, { domain, operationId: "authenticated.layout" });
  const [tenant] = await db
    .select({ id: tenantTable.id, name: tenantTable.name })
    .from(tenantTable)
    .where(and(eq(tenantTable.id, principal.tenantId), eq(tenantTable.domain, domain)))
    .limit(1);
  if (!tenant) throw new Error("Authorized Tenant disappeared during request");
  const permissions = [...principal.permissions].sort();

  const features = await getResolvedTenantFeatures(tenant.id);
  const pathname = requestHeaders.get(TENANT_PATHNAME_HEADER);
  const gatedArea = pathname
    ? getMasterDataGatedArea(getTenantRelativePath(domain, pathname))
    : null;
  const missing = gatedArea
    ? getMissingUrgentMasterData(domain, await getUrgentMasterDataPresence(tenant.id))
    : [];
  const content = gatedArea && missing.length > 0
    ? <MasterDataAccessBlocked area={gatedArea} missing={missing} domain={domain} canManageMasterData={permissions.some((permission) => permission.startsWith("school-profile.") || permission.startsWith("academic-years."))} />
    : children;

  return <SidebarProvider>
    <TenantSidebar permissions={permissions} domain={domain} tenantName={tenant.name} features={features} />
    <SidebarInset>
      <TrialBanner domain={domain} />
      <DashboardHeader domain={domain} />
      <div className="flex flex-1 flex-col gap-6 p-4 pt-6 md:p-6">{content}</div>
    </SidebarInset>
  </SidebarProvider>;
}
