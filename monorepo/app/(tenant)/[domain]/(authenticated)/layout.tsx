import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { TenantSidebar } from "@/components/dashboard/tenant-sidebar";
import { TrialBanner } from "@/components/dashboard/trial-banner";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { auth } from "@/lib/auth";
import { enforceTenantPageAccess } from "@/lib/tenant-access";
import { isTenantRole } from "@/types/TenantRole";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

export default async function DashboardLayout({ children, params }: {
  children: React.ReactNode;
  params: Promise<{ domain: string }>;
}) {
  const { domain } = await params;
  await enforceTenantPageAccess(domain);
  const session = await auth.api.getSession({ headers: await headers() });
  const role = session?.user.tenantRole;
  if (!isTenantRole(role)) notFound();

  return <SidebarProvider>
    <TenantSidebar role={role} />
    <SidebarInset>
      <TrialBanner domain={domain} />
      <DashboardHeader domain={domain} />
      <div className="flex flex-1 flex-col gap-6 p-4 pt-6 md:p-6">{children}</div>
    </SidebarInset>
  </SidebarProvider>;
}
