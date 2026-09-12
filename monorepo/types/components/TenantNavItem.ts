import { type LucideIcon } from "lucide-react"
import type { TenantFeatureKey } from "@/config/tenant-features"
export type TenantNavItem = {
  /** Stable identifier used by Provider to toggle sidebar visibility per Tenant. */
  key: string
  title: string
  url?: string
  icon?: LucideIcon
  requiredPermissions?: readonly string[]
  permissionMode?: "all" | "any"
  group?: string
  feature?: TenantFeatureKey
  items?: Omit<TenantNavItem, "icon" | "group">[]
}
