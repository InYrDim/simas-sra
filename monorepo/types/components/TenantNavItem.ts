import { type LucideIcon } from "lucide-react"
import type { TenantFeatureKey } from "@/config/tenant-features"
import { type TenantRoleMatcher } from "@/types/TenantRole"

export type TenantNavItem = {
  title: string
  url?: string
  icon?: LucideIcon
  roles: TenantRoleMatcher[]
  group?: string
  feature?: TenantFeatureKey
  items?: Omit<TenantNavItem, "icon" | "group">[]
}
