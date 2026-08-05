"use client";

import * as React from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ChevronRight } from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";

import { isProviderRouteActive } from "./is-provider-route-active";
import type { ProviderNavGroup, ProviderNavItem } from "./types";

const groupLabels: Record<ProviderNavGroup, string> = {
  main: "Utama",
  operations: "Operasional",
};

function ProviderNavCollapsibleItem({ item, pathname }: { item: ProviderNavItem, pathname: string }) {
  const { isMobile, setOpenMobile } = useSidebar();
  const subItems = item.subItems || [];
  const isActive = subItems.some((subItem) => isProviderRouteActive(pathname, subItem.href, subItem.exactMatch));

  const [isOpen, setIsOpen] = React.useState(isActive);
  const [prevPathname, setPrevPathname] = React.useState(pathname);

  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    if (isActive) {
      setIsOpen(true);
    }
  }

  const Icon = item.icon;

  return (
    <SidebarMenuItem>
      <Collapsible
        open={isOpen}
        onOpenChange={setIsOpen}
        className="group/collapsible"
      >
        <CollapsibleTrigger render={
          <SidebarMenuButton tooltip={item.title}>
            <Icon aria-hidden="true" />
            <span>{item.title}</span>
            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        } />
        <CollapsibleContent>
          <SidebarMenuSub>
            {subItems.map((subItem) => {
              const subActive = isProviderRouteActive(pathname, subItem.href, subItem.exactMatch);
              return (
                <SidebarMenuSubItem key={subItem.href}>
                  <SidebarMenuSubButton
                    render={
                      <Link 
                        href={subItem.href} 
                        aria-current={subActive ? "page" : undefined}
                        onClick={() => isMobile && setOpenMobile(false)}
                      />
                    }
                    isActive={subActive}
                  >
                    <span>{subItem.title}</span>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </Collapsible>
    </SidebarMenuItem>
  );
}

export function ProviderNavMenu({ items }: { items: readonly ProviderNavItem[] }) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();

  return (["main", "operations"] as const).map((group) => (
    <SidebarGroup key={group}>
      <SidebarGroupLabel>{groupLabels[group]}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.filter((item) => item.group === group).map((item) => {
            const active = isProviderRouteActive(pathname, item.href, item.exactMatch);
            const Icon = item.icon;

            return item.subItems && item.subItems.length > 0 ? (
              <ProviderNavCollapsibleItem key={item.title} item={item} pathname={pathname} />
            ) : (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  render={
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      onClick={() => isMobile && setOpenMobile(false)}
                    />
                  }
                  isActive={active}
                  tooltip={item.title}
                >
                  <Icon aria-hidden="true" />
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  ));
}
