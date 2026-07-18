import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/dashboard/app-sidebar"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { TrialBanner } from "@/components/dashboard/trial-banner"

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
      {/* Assuming AppSidebar handles its own client logic if necessary, or we pass a default role */}
      {/* For now we just pass 'staff' as default since role state was moved to Header, 
          ideally sidebar items are determined server-side or via context */}
      <AppSidebar role="staff" />
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
