import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { TrialBanner } from "@/components/dashboard/trial-banner"
import { TenantSidebar } from "@/components/dashboard/tenant-sidebar"

export default async function DashboardLayout({
  children,
  params
}: {
  children: React.ReactNode,
  params: Promise<{ domain: string }>
}) {
  const { domain } = await params;

  return (
    <SidebarProvider>
      <TenantSidebar role="staff" />
      <SidebarInset>
        <TrialBanner domain={domain} />
        <DashboardHeader domain={domain} />
        <div className="flex flex-1 flex-col p-4 md:p-6 pt-6 gap-6">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
