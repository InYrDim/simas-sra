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
import { BookOpen, LogOut } from "lucide-react"
import { TenantNavMenu } from "@/components/tenant-nav-menu"
import { tenantMenuItems } from "@/components/tenant-nav-menu/config"
import { authClient } from "@/lib/auth-client"

import { type TenantRole } from "@/types/TenantRole"

export function TenantSidebar({ role, domain, tenantName }: { role: TenantRole; domain: string; tenantName?: string }) {
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
        <TenantNavMenu items={tenantMenuItems} role={role} domain={domain} />
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => authClient.signOut({ fetchOptions: { onSuccess: () => window.location.assign("/login") } })}
              tooltip="Keluar"
              variant="outline"
            >
              <LogOut />
              <span>Keluar</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  </div>
  )
}
