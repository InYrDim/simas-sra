export type TenantUserDirectoryAccess = Readonly<{
  contact: boolean;
  sensitive: boolean;
}>;

export type TenantUserDirectorySourceRow = Readonly<{
  id: string;
  name: string;
  email: string;
  tenantRole: string | null;
  emailVerified: boolean;
}>;

export type TenantUserDirectoryRow = Readonly<{
  id: string;
  name: string;
  email?: string;
  tenantRole?: string | null;
  emailVerified?: boolean;
}>;

export function tenantUserDirectoryProjection(access: TenantUserDirectoryAccess) {
  return [
    "id",
    "name",
    ...(access.contact ? ["email"] : []),
    ...(access.sensitive ? ["tenantRole", "emailVerified"] : []),
  ] as const;
}

export function projectTenantUserDirectoryRow(
  row: TenantUserDirectorySourceRow,
  access: TenantUserDirectoryAccess,
): TenantUserDirectoryRow {
  return {
    id: row.id,
    name: row.name,
    ...(access.contact ? { email: row.email } : {}),
    ...(access.sensitive
      ? { tenantRole: row.tenantRole, emailVerified: row.emailVerified }
      : {}),
  };
}
