import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { TrialBanner } from "@/components/dashboard/trial-banner"
import { TenantSidebar } from "@/components/dashboard/tenant-sidebar"
import { requireTenantFeatureAccess } from "@/lib/tenant-access"
import { TenantActivationError } from "@/lib/school-admin-activation"
import { redirect } from "next/navigation"

export default async function DashboardLayout({
  children,
  params
}: {
  children: React.ReactNode,
  params: Promise<{ domain: string }>
}) {
  const { domain } = await params;
  try {
    await requireTenantFeatureAccess(domain);
  } catch (error) {
    if (error instanceof TenantActivationError && error.code === "password-change-required") {
      redirect("/change-password");
    }
    throw error;
  }

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
