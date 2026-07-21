"use client"

import * as React from "react"
import { ChevronRight } from "lucide-react"
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

import { type TenantRole } from "@/types/TenantRole"
import { type TenantNavItem } from "@/types/components/TenantNavItem"

export function tenantNavigationHref(domain: string, url: string | undefined) {
  if (!url) return "#"
  const normalizedDomain = domain.trim().replace(/^\/+|\/+$/g, "")
  const normalizedUrl = url.startsWith("/") ? url : `/${url}`
  return `/${normalizedDomain}${normalizedUrl}`
}

function TenantNavCollapsibleItem({ item, role, pathname, domain }: { item: TenantNavItem, role: TenantRole, pathname: string, domain: string }) {
  const filteredSubItems = item.items!.filter((subItem) => subItem.roles.includes(role) || subItem.roles.includes("*"))
  const isActive = filteredSubItems.some((subItem) => pathname === tenantNavigationHref(domain, subItem.url))

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
                  render={<Link href={tenantNavigationHref(domain, subItem.url)} aria-current={pathname === tenantNavigationHref(domain, subItem.url) ? "page" : undefined} />}
                  isActive={pathname === tenantNavigationHref(domain, subItem.url)}
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

export function TenantNavMenu({
  items,
  role,
  domain,
}: {
  items: TenantNavItem[]
  role: TenantRole
  domain: string
}) {
  const pathname = usePathname()

  // Filter root items by role
  const filteredItems = items.filter((item) => item.roles.includes(role) || item.roles.includes("*"))

  // Group items by their "group" property, default to "Menu Utama"
  const groupedItems = filteredItems.reduce((acc, item) => {
    const groupName = item.group || "Menu Utama"
    if (!acc[groupName]) acc[groupName] = []
    acc[groupName].push(item)
    return acc
  }, {} as Record<string, TenantNavItem[]>)

  return (
    <>
      {Object.entries(groupedItems).map(([groupName, groupItems]) => (
        <SidebarGroup key={groupName}>
          <SidebarGroupLabel>{groupName}</SidebarGroupLabel>
          <SidebarMenu>
            {groupItems.map((item) => {
              // Nested item scenario
              if (item.items && item.items.length > 0) {
                return <TenantNavCollapsibleItem key={item.title} item={item} role={role} pathname={pathname} domain={domain} />
              }

              // Normal item scenario
              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    render={<Link href={tenantNavigationHref(domain, item.url)} aria-current={pathname === tenantNavigationHref(domain, item.url) ? "page" : undefined} />}
                    tooltip={item.title}
                    isActive={pathname === tenantNavigationHref(domain, item.url)}
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
