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
import { Home, Users, Settings, BookOpen, LogOut } from "lucide-react"
import Link from "next/link"
import { NavMenu, type NavItem } from "@/components/nav-menu"

export type Role = "superadmin" | "pimpinan" | "staff" | "guru" | "siswa"

const menuItems: NavItem[] = [
  {
    title: "Dasbor",
    icon: Home,
    url: "/",
    roles: ["superadmin", "pimpinan", "staff", "guru", "siswa"]
  },
  {
    title: "Data Siswa",
    icon: Users,
    url: "/siswa",
    roles: ["staff", "guru", "pimpinan"]
  },
  {
    title: "Akademik",
    icon: BookOpen,
    roles: ["staff", "guru", "siswa", "pimpinan"],
    items: [
      { title: "Jadwal Pelajaran", url: "/akademik/jadwal", roles: ["staff", "guru", "siswa", "pimpinan"] },
      { title: "Penilaian & Rapor", url: "/akademik/nilai", roles: ["guru", "siswa", "pimpinan"] }
    ]
  },
  {
    title: "Pengaturan",
    icon: Settings,
    roles: ["superadmin"],
    group: "Sistem & Keamanan",
    items: [
      { title: "Manajemen Pengguna", url: "/users", roles: ["superadmin"] },
      { title: "Pengaturan Sistem", url: "/settings", roles: ["superadmin"] }
    ]
  },
]

export function AppSidebar({ role }: { role: Role }) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-16 flex items-center justify-center border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 overflow-hidden w-full group-data-[collapsible=icon]:justify-center">
          <div className="bg-primary p-1.5 rounded-md shrink-0 flex items-center justify-center">
            <BookOpen className="size-4 text-primary-foreground" />
          </div>
          <span className="font-bold tracking-tight truncate group-data-[collapsible=icon]:hidden">SIMAS</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <NavMenu items={menuItems} role={role} />
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton render={<Link href="/login" />} variant="outline" className="text-destructive hover:bg-destructive/10 hover:text-destructive">
              <LogOut />
              <span>Keluar</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
