import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { TenantSidebar } from "@/components/dashboard/tenant-sidebar";
import { TrialBanner } from "@/components/dashboard/trial-banner";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { enforceTenantPageAccess } from "@/lib/tenant-access";

export default async function DashboardLayout({ children, params }: {
  children: React.ReactNode;
  params: Promise<{ domain: string }>;
}) {
  const { domain } = await params;
  await enforceTenantPageAccess(domain);

  return <SidebarProvider>
    <TenantSidebar role="staff" />
    <SidebarInset>
      <TrialBanner domain={domain} />
      <DashboardHeader domain={domain} />
      <div className="flex flex-1 flex-col gap-6 p-4 pt-6 md:p-6">{children}</div>
    </SidebarInset>
  </SidebarProvider>;
}
