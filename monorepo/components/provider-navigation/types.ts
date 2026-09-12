import type { LucideIcon } from "lucide-react";

export type ProviderNavGroup = "main" | "operations";

export type ProviderNavItem = Readonly<{
  title: string;
  href: string;
  icon: LucideIcon;
  group: ProviderNavGroup;
  availability: "available" | "empty-state";
  exactMatch?: boolean;
  subItems?: readonly Readonly<{
    title: string;
    href: string;
    availability: "available" | "empty-state";
    exactMatch?: boolean;
  }>[];
}>;
