"use client";

import { ProviderSidebar } from "@/components/provider/provider-sidebar";
import { Button } from "@/components/ui/button";
import {
  SidebarInset,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar";
import type { ProviderPrincipal } from "@/lib/provider-access";
import { PanelLeft } from "lucide-react";

function ProviderHeader() {
  const { isMobile, open, openMobile, toggleSidebar } = useSidebar();
  const expanded = isMobile ? openMobile : open;

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b bg-background px-4 md:px-6">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={expanded ? "Tutup navigasi Provider" : "Buka navigasi Provider"}
        aria-expanded={expanded}
        aria-controls="provider-navigation"
        onClick={toggleSidebar}
      >
        <PanelLeft aria-hidden="true" />
      </Button>
      <div>
        <p className="text-sm font-semibold">Provider</p>
        <p className="text-xs text-muted-foreground">Administrasi layanan SIMAS</p>
      </div>
    </header>
  );
}

export function ProviderShell({ children, principal }: { children: React.ReactNode; principal: ProviderPrincipal }) {
  return (
    <SidebarProvider className="bg-muted/30">
      <div id="provider-navigation" className="contents">
        <ProviderSidebar principal={principal} />
      </div>
      <SidebarInset>
        <ProviderHeader />
        <main className="flex flex-1 flex-col p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
