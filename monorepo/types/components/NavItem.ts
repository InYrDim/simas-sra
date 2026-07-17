import { type LucideIcon } from "lucide-react"
import { Role } from "@/types/Role"

export type NavItem = {
  title: string
  url?: string
  icon?: LucideIcon
  roles: Role[]
  group?: string
  items?: Omit<NavItem, "icon" | "group">[]
}
