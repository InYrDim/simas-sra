"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";

export function DashboardHeader({ domain }: { domain: string }) {
  return (
    <>
      <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur px-4">
        <SidebarTrigger className="-ml-1" />
        <div className="w-px h-6 bg-border mx-2" />

        <div className="flex-1 flex justify-between items-center overflow-x-auto">
          <div className="flex items-center gap-2">
            <h1 className="font-semibold truncate">Dasbor Utama</h1>
            <span className="text-xs font-medium text-muted-foreground">{domain}</span>
          </div>
        </div>
      </header>
    </>
  );
}
