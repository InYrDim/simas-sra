import "server-only";

import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { user } from "@/db/schema";
import {
  type TenantUserDirectoryAccess,
  type TenantUserDirectoryRow,
} from "@/lib/authorization/tenant-user-directory";

export async function listTenantUserDirectory(
  tenantId: string,
  access: TenantUserDirectoryAccess,
): Promise<readonly TenantUserDirectoryRow[]> {
  return db
    .select({
      id: user.id,
      name: user.name,
      ...(access.contact ? { email: user.email } : {}),
      ...(access.sensitive ? { emailVerified: user.emailVerified } : {}),
    })
    .from(user)
    .where(eq(user.tenantId, tenantId))
    .orderBy(asc(user.name), asc(user.id)) as Promise<readonly TenantUserDirectoryRow[]>;
}
