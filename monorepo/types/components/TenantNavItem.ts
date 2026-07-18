import { type LucideIcon } from "lucide-react"
import { type TenantRoleMatcher } from "@/types/TenantRole"

export type TenantNavItem = {
  title: string
  url?: string
  icon?: LucideIcon
  roles: TenantRoleMatcher[]
  group?: string
  items?: Omit<TenantNavItem, "icon" | "group">[]
}
