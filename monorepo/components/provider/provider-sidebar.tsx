"use client";

import { ShieldCheck } from "lucide-react";

import { providerNavItems } from "@/components/provider-navigation/config";
import { ProviderNavMenu } from "@/components/provider-navigation/provider-nav-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import type { ProviderPrincipal } from "@/lib/provider-access";

export function ProviderSidebar({ principal }: { principal: ProviderPrincipal }) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip="SIMAS Provider">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <ShieldCheck aria-hidden="true" />
              </span>
              <span className="grid text-left leading-tight">
                <span className="font-semibold">SIMAS Provider</span>
                <span className="text-xs text-muted-foreground">Administrasi layanan</span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <ProviderNavMenu items={providerNavItems} />
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip={`${principal.name} — Provider Admin`}>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted font-semibold" aria-hidden="true">
                {principal.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="grid min-w-0 text-left leading-tight">
                <span className="truncate font-medium">{principal.name}</span>
                <span className="truncate text-xs text-muted-foreground">{principal.email}</span>
                <span className="text-xs text-muted-foreground">Provider Admin</span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
