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
import Link from "next/link"
import { NavMenu } from "@/components/nav-menu"
import { menuItems } from "@/components/nav-menu/config"

import { Role } from "@/types/Role"

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
