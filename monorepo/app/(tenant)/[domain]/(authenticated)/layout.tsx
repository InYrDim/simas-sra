import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { TenantSidebar } from "@/components/dashboard/tenant-sidebar";
import { TrialBanner } from "@/components/dashboard/trial-banner";
import { MasterDataAccessBlocked } from "@/components/dashboard/master-data-access-blocked";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { auth } from "@/lib/auth";
import {
  getMasterDataGatedArea,
  getMissingUrgentMasterData,
  getTenantRelativePath,
} from "@/lib/dashboard-master-data";
import { getUrgentMasterDataPresence } from "@/lib/dashboard-master-data-data";
import { TENANT_PATHNAME_HEADER } from "@/lib/proxy-routing";
import { enforceTenantPageAccess } from "@/lib/tenant-access";
import { isTenantRole } from "@/types/TenantRole";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

export default async function DashboardLayout({ children, params }: {
  children: React.ReactNode;
  params: Promise<{ domain: string }>;
}) {
  const { domain } = await params;
  const requestHeaders = await headers();
  const tenant = await enforceTenantPageAccess(domain);
  const session = await auth.api.getSession({ headers: requestHeaders });
  const role = session?.user.tenantRole;
  if (!isTenantRole(role)) notFound();

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
    <TenantSidebar role={role} domain={domain} tenantName={tenant.name} />
    <SidebarInset>
      <TrialBanner domain={domain} />
      <DashboardHeader domain={domain} />
      <div className="flex flex-1 flex-col gap-6 p-4 pt-6 md:p-6">{content}</div>
    </SidebarInset>
  </SidebarProvider>;
}
