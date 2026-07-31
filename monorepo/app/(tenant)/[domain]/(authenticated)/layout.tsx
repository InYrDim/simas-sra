import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { TenantSidebar } from "@/components/dashboard/tenant-sidebar";
import { TrialBanner } from "@/components/dashboard/trial-banner";
import { MasterDataAccessBlocked } from "@/components/dashboard/master-data-access-blocked";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

import {
  getMasterDataGatedArea,
  getMissingUrgentMasterData,
  getTenantRelativePath,
} from "@/lib/master-data/dashboard-master-data";
import { getUrgentMasterDataPresence } from "@/lib/master-data/dashboard-master-data-data";
import { getResolvedTenantFeatures } from "@/lib/features/tenant-feature-access-data";
import { TENANT_PATHNAME_HEADER } from "@/lib/platform/proxy-routing";
import { enforceTenantPageAccess } from "@/lib/tenancy/tenant-access";

import { headers } from "next/headers";


export default async function DashboardLayout({ children, params }: {
  children: React.ReactNode;
  params: Promise<{ domain: string }>;
}) {
  const { domain } = await params;
  const requestHeaders = await headers();
  const tenant = await enforceTenantPageAccess(domain);
  const role = tenant.principal.tenantRole;

  const features = await getResolvedTenantFeatures(tenant.id);
  const pathname = requestHeaders.get(TENANT_PATHNAME_HEADER);
  const gatedArea = pathname
    ? getMasterDataGatedArea(getTenantRelativePath(domain, pathname))
    : null;
  const missing = gatedArea
    ? getMissingUrgentMasterData(domain, await getUrgentMasterDataPresence(tenant.id))
    : [];
  const content = gatedArea && missing.length > 0
    ? <MasterDataAccessBlocked area={gatedArea} missing={missing} domain={domain} canManageMasterData={role === "school-admin"} />
    : children;

  return <SidebarProvider>
    <TenantSidebar role={role} domain={domain} tenantName={tenant.name} features={features} />
    <SidebarInset>
      <TrialBanner domain={domain} />
      <DashboardHeader domain={domain} />
      <div className="flex flex-1 flex-col gap-6 p-4 pt-6 md:p-6">{content}</div>
    </SidebarInset>
  </SidebarProvider>;
}
