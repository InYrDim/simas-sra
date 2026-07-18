export type TenantRole =
  | "school-admin"
  | "pimpinan"
  | "staff"
  | "guru"
  | "siswa"
  | "guest"

export type TenantRoleMatcher = TenantRole | "*"
