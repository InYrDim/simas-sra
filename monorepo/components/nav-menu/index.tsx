"use client"

import * as React from "react"
import { ChevronRight, type LucideIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import type { Role } from "../dashboard/app-sidebar"

export type NavItem = {
  title: string
  url?: string
  icon?: LucideIcon
  roles: Role[]
  group?: string
  items?: Omit<NavItem, "icon" | "group">[]
}

function NavCollapsibleItem({ item, role, pathname }: { item: NavItem, role: Role, pathname: string }) {
  const filteredSubItems = item.items!.filter((subItem) => subItem.roles.includes(role))
  const isActive = filteredSubItems.some((subItem) => pathname === subItem.url)

  const [isOpen, setIsOpen] = React.useState(isActive)
  const [prevPathname, setPrevPathname] = React.useState(pathname)

  // Update open state if navigation changes and child becomes active (No useEffect needed)
  if (pathname !== prevPathname) {
    setPrevPathname(pathname)
    if (isActive) {
      setIsOpen(true)
    }
  }

  if (filteredSubItems.length === 0) return null

  return (
    <SidebarMenuItem>
      <Collapsible
        open={isOpen}
        onOpenChange={setIsOpen}
        className="group/collapsible"
      >
        <CollapsibleTrigger render={
          <SidebarMenuButton tooltip={item.title}>
            {item.icon && <item.icon />}
            <span>{item.title}</span>
            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        } />
        <CollapsibleContent>
          <SidebarMenuSub>
            {filteredSubItems.map((subItem) => (
              <SidebarMenuSubItem key={subItem.title}>
                <SidebarMenuSubButton
                  render={<Link href={subItem.url || "#"} />}
                  isActive={pathname === subItem.url}
                >
                  <span>{subItem.title}</span>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </Collapsible>
    </SidebarMenuItem>
  )
}

export function NavMenu({
  items,
  role,
}: {
  items: NavItem[]
  role: Role
}) {
  const pathname = usePathname()

  // Filter root items by role
  const filteredItems = items.filter((item) => item.roles.includes(role))

  // Group items by their "group" property, default to "Menu Utama"
  const groupedItems = filteredItems.reduce((acc, item) => {
    const groupName = item.group || "Menu Utama"
    if (!acc[groupName]) acc[groupName] = []
    acc[groupName].push(item)
    return acc
  }, {} as Record<string, NavItem[]>)

  return (
    <>
      {Object.entries(groupedItems).map(([groupName, groupItems]) => (
        <SidebarGroup key={groupName}>
          <SidebarGroupLabel>{groupName}</SidebarGroupLabel>
          <SidebarMenu>
            {groupItems.map((item) => {
              // Nested item scenario
              if (item.items && item.items.length > 0) {
                return <NavCollapsibleItem key={item.title} item={item} role={role} pathname={pathname} />
              }

              // Normal item scenario
              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    render={<Link href={item.url || "#"} />}
                    tooltip={item.title}
                    isActive={pathname === item.url}
                  >
                    {item.icon && <item.icon />}
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>
      ))}
    </>
  )
}
