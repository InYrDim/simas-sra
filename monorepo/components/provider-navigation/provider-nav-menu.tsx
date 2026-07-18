"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

import { isProviderRouteActive } from "./is-provider-route-active";
import type { ProviderNavGroup, ProviderNavItem } from "./types";

const groupLabels: Record<ProviderNavGroup, string> = {
  main: "Utama",
  operations: "Operasional",
};

export function ProviderNavMenu({ items }: { items: readonly ProviderNavItem[] }) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();

  return (["main", "operations"] as const).map((group) => (
    <SidebarGroup key={group}>
      <SidebarGroupLabel>{groupLabels[group]}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.filter((item) => item.group === group).map((item) => {
            const active = isProviderRouteActive(pathname, item.href);
            const Icon = item.icon;

            return (
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
