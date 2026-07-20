export type TenantRole =
  | "school-admin"
  | "pimpinan"
  | "staff"
  | "guru"
  | "siswa"
  | "guest"

export type TenantRoleMatcher = TenantRole | "*"

const tenantRoles: readonly TenantRole[] = [
  "school-admin",
  "pimpinan",
  "staff",
  "guru",
  "siswa",
  "guest",
]

export function isTenantRole(value: unknown): value is TenantRole {
  return tenantRoles.includes(value as TenantRole)
}
