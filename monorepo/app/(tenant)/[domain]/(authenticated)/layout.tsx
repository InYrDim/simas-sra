"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/dashboard/app-sidebar"
import { Role } from "@/types/Role"
import { Button } from "@/components/ui/button"

export default function DashboardLayout({ children}: { children: React.ReactNode }) {
  const params = useParams();
  const [role, setRole] = useState<Role>("staff");

  return (
    <SidebarProvider>
      <AppSidebar role={role} />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur px-4">
          <SidebarTrigger className="-ml-1" />
          <div className="w-px h-6 bg-border mx-2" />

          <div className="flex-1 flex justify-between items-center overflow-x-auto">
            <div className="flex items-center gap-2">
              <h1 className="font-semibold truncate">Dasbor Utama</h1>
              <span className="text-xs font-medium text-muted-foreground">{params.domain as string}</span>
            </div>
            <div className="flex items-center gap-2 flex-nowrap shrink-0">
              <span className="text-xs font-medium text-muted-foreground mr-2 hidden sm:inline-block">
                Tampilan Role:
              </span>
              <Button size="xs" variant={role === "superadmin" ? "default" : "outline"} onClick={() => setRole("superadmin")}>
                Superadmin
              </Button>
              <Button size="xs" variant={role === "pimpinan" ? "default" : "outline"} onClick={() => setRole("pimpinan")}>
                Pimpinan
              </Button>
              <Button size="xs" variant={role === "staff" ? "default" : "outline"} onClick={() => setRole("staff")}>
                Staff
              </Button>
              <Button size="xs" variant={role === "guru" ? "default" : "outline"} onClick={() => setRole("guru")}>
                Guru
              </Button>
              <Button size="xs" variant={role === "siswa" ? "default" : "outline"} onClick={() => setRole("siswa")}>
                Siswa
              </Button>
            </div>
          </div>
        </header>
        <div className="flex flex-1 flex-col p-4 md:p-6 pt-6 gap-6">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
