"use client"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter
} from "@/components/ui/sidebar"
import { Home, Users, Settings, BookOpen, GraduationCap, DollarSign, LogOut } from "lucide-react"
import Link from "next/link"

export type Role = "admin" | "guru" | "siswa"

const menuItems = [
  { title: "Dasbor", icon: Home, url: "/dashboard", roles: ["admin", "guru", "siswa"] },
  { title: "Data Siswa", icon: Users, url: "/dashboard/siswa", roles: ["admin", "guru"] },
  { title: "Mata Pelajaran", icon: BookOpen, url: "/dashboard/mapel", roles: ["admin", "guru", "siswa"] },
  { title: "Penilaian", icon: GraduationCap, url: "/dashboard/nilai", roles: ["guru", "siswa"] },
  { title: "Keuangan", icon: DollarSign, url: "/dashboard/keuangan", roles: ["admin"] },
  { title: "Pengaturan", icon: Settings, url: "/dashboard/settings", roles: ["admin"] },
]

export function AppSidebar({ role }: { role: Role }) {
  const filteredItems = menuItems.filter(item => item.roles.includes(role));

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
        <SidebarGroup>
          <SidebarGroupLabel>Menu Utama</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton render={<Link href={item.url} />} tooltip={item.title}>
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
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
