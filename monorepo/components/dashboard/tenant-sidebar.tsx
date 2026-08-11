"use client"

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter
} from "@/components/ui/sidebar"
import { BookOpen, LogOut, AlertCircle } from "lucide-react"
import { TenantNavMenu } from "@/components/tenant-nav-menu"
import { tenantMenuItems } from "@/components/tenant-nav-menu/config"
import { authClient } from "@/lib/platform/auth-client"

import type { TenantFeatureSelection } from "@/lib/features/tenant-feature-policy"

export function TenantSidebar({
  permissions,
  domain,
  tenantName,
  features,
  trialStarted,
  menuVisibility,
}: {
  permissions: readonly string[];
  domain: string;
  tenantName?: string;
  features: TenantFeatureSelection;
  trialStarted?: boolean;
  menuVisibility?: Record<string, boolean>;
}) {
  return (
    <div
      style={
        {
          "--sidebar": "#0f172a",
          "--sidebar-foreground": "#f8fafc",
          "--sidebar-primary": "#38bdf8",
          "--sidebar-primary-foreground": "#082f49",
          "--sidebar-accent": "#1e3a5f",
          "--sidebar-accent-foreground": "#f8fafc",
          "--sidebar-border": "#334155",
          "--sidebar-ring": "#38bdf8",
        } as React.CSSProperties
      }
    >
    <Sidebar
      collapsible="icon"
    >
      <SidebarHeader className="h-16 flex items-center justify-center border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 overflow-hidden w-full group-data-[collapsible=icon]:justify-center">
          <div className="bg-sidebar-primary p-1.5 rounded-md shrink-0 flex items-center justify-center">
            <BookOpen className="size-4 text-sidebar-primary-foreground" />
          </div>
          <div className="flex flex-col overflow-hidden group-data-[collapsible=icon]:hidden">
            <span className="font-bold tracking-tight truncate">SIMAS</span>
            {tenantName && (
              <span className="text-xs text-sidebar-foreground/70 truncate" title={tenantName}>
                {tenantName}
              </span>
            )}
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {trialStarted !== false ? (
          <TenantNavMenu items={tenantMenuItems} permissions={permissions} domain={domain} features={features} menuVisibility={menuVisibility} />
        ) : (
          <div className="flex flex-col items-center justify-center p-6 text-center text-sidebar-foreground/60 h-32 gap-3 group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:h-auto">
            <AlertCircle className="size-6 text-amber-500/80" />
            <p className="text-sm font-medium group-data-[collapsible=icon]:hidden">
              Selesaikan Onboarding untuk mengakses menu
            </p>
          </div>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => authClient.signOut({ fetchOptions: { onSuccess: () => window.location.assign("/login") } })}
              tooltip="Keluar"
              variant="outline"
              className="border-red-400/20 bg-red-500/5 text-red-300 hover:border-red-400/40 hover:bg-red-500/15 hover:text-red-100"
            >
              <LogOut />
              <span>Keluar</span>
              <span>Keluar</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  </div>
  )
}
