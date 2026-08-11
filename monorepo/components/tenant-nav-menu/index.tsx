"use client"

import * as React from "react"
import { ChevronRight, LockKeyhole } from "lucide-react"
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

import type { TenantFeatureSelection } from "@/lib/features/tenant-feature-policy"
import { resolveHiddenMenuKeys } from "@/lib/features/tenant-menu-visibility"
import { type TenantNavItem } from "@/types/components/TenantNavItem"
// The predicate is a pure authorization function shared with server-side
// helpers. It lives in a plain (non-"use client") module so Server Components
// can import it without crossing the RSC boundary; re-export keeps the old
// `@/components/tenant-nav-menu` import path compatible for client callers.
import { isNavigationItemAuthorized } from "@/lib/authorization/tenant-nav-item-authorization"
export { isNavigationItemAuthorized }

export function tenantNavigationHref(domain: string, url: string | undefined) {
  if (!url) return "#"
  const normalizedDomain = domain.trim().replace(/^\/+|\/+$/g, "")
  const normalizedUrl = url.startsWith("/") ? url : `/${url}`
  return `/${normalizedDomain}${normalizedUrl}`
}

function isNavigationItemLeafAuthorized(item: TenantNavItem, permissions: ReadonlySet<string>): boolean {
  if (item.items?.length) {
    return item.items.some((child) => isNavigationItemLeafAuthorized(child, permissions))
  }
  return isNavigationItemAuthorized(item, permissions)
}

function TenantNavCollapsibleItem({ item, permissions, pathname, domain, disabled, hiddenKeys }: { item: TenantNavItem, permissions: ReadonlySet<string>, pathname: string, domain: string, disabled: boolean, hiddenKeys: Set<string> | null }) {
  const filteredSubItems = item.items!.filter((subItem) => !hiddenKeys?.has(subItem.key) && isNavigationItemLeafAuthorized(subItem, permissions))
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

  if (disabled) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          className="cursor-not-allowed opacity-45"
          disabled
          tooltip={`${item.title} dinonaktifkan oleh Provider`}
        >
          {item.icon && <item.icon />}
          <span>{item.title}</span>
          <LockKeyhole className="ml-auto" />
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

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
  permissions,
  domain,
  features,
  menuVisibility,
}: {
  items: TenantNavItem[]
  permissions: readonly string[]
  domain: string
  features: TenantFeatureSelection
  menuVisibility?: Record<string, boolean>
}) {
  const pathname = usePathname()
  const permissionSet = new Set(permissions)
  const hiddenKeys = menuVisibility ? resolveHiddenMenuKeys(menuVisibility) : null

  const filteredItems = items.filter((item) => {
    if (hiddenKeys?.has(item.key)) return false
    return isNavigationItemLeafAuthorized(item, permissionSet)
  })

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
              const disabled = Boolean(item.feature && !features[item.feature])

              // Nested item scenario
              if (item.items && item.items.length > 0) {
                return <TenantNavCollapsibleItem key={item.title} item={item} permissions={permissionSet} pathname={pathname} domain={domain} disabled={disabled} hiddenKeys={hiddenKeys} />
              }

              // Normal item scenario
              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    className={disabled ? "cursor-not-allowed opacity-45" : undefined}
                    disabled={disabled}
                    render={disabled ? undefined : <Link href={tenantNavigationHref(domain, item.url)} aria-current={pathname === tenantNavigationHref(domain, item.url) ? "page" : undefined} />}
                    tooltip={disabled ? `${item.title} dinonaktifkan oleh Provider` : item.title}
                    isActive={!disabled && pathname === tenantNavigationHref(domain, item.url)}
                  >
                    {item.icon && <item.icon />}
                    <span>{item.title}</span>
                    {disabled ? <LockKeyhole className="ml-auto" /> : null}
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
