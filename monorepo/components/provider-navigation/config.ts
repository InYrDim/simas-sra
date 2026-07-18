import {
  Building2,
  ChartNoAxesCombined,
  ClipboardList,
  CreditCard,
  Headset,
  LogIn,
  Settings,
  Shapes,
} from "lucide-react";

import type { ProviderNavItem } from "./types";

export const providerNavItems: readonly ProviderNavItem[] = [
  { title: "Ringkasan", href: "/provider", icon: ChartNoAxesCombined, group: "main", availability: "available" },
  { title: "Tenant", href: "/provider/tenants", icon: Building2, group: "main", availability: "available" },
  { title: "Fitur", href: "/provider/features", icon: Shapes, group: "main", availability: "empty-state" },
  { title: "Billing", href: "/provider/billing", icon: CreditCard, group: "main", availability: "empty-state" },
  { title: "Impersonasi", href: "/provider/impersonation", icon: LogIn, group: "operations", availability: "empty-state" },
  { title: "Audit Log", href: "/provider/audit-log", icon: ClipboardList, group: "operations", availability: "empty-state" },
  { title: "Support Ticket", href: "/provider/support-tickets", icon: Headset, group: "operations", availability: "empty-state" },
  { title: "Pengaturan Provider", href: "/provider/settings", icon: Settings, group: "operations", availability: "empty-state" },
];
