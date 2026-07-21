import "server-only";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";

import { db } from "@/db";
import { tenant, user } from "@/db/schema";
import { auth } from "@/lib/auth";
import {
  authorizeMasterDataAccess,
  type MasterDataAccessResult,
  type MasterDataOperation,
} from "@/lib/tenant-master-data-access";
import { parseMasterDataFeaturePolicy } from "@/lib/tenant-master-data-feature-policy";

export async function getMasterDataAccess(
  requestedDomain: string,
  operation: MasterDataOperation,
  now = new Date(),
): Promise<MasterDataAccessResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { kind: "not-found" };

  const [[membership], [requestedTenant]] = await Promise.all([
    db
      .select({ userId: user.id, tenantId: user.tenantId, tenantRole: user.tenantRole })
      .from(user)
      .where(eq(user.id, session.user.id))
      .limit(1),
    db
      .select({
        id: tenant.id,
        domain: tenant.domain,
        operationalStatus: tenant.operationalStatus,
        trialEndsAt: tenant.trialEndsAt,
        settings: tenant.settings,
      })
      .from(tenant)
      .where(eq(tenant.domain, requestedDomain))
      .limit(1),
  ]);

  if (!membership) return { kind: "not-found" };

  return authorizeMasterDataAccess({
    session: membership,
    requestedDomain,
    tenant: requestedTenant
      ? {
          id: requestedTenant.id,
          domain: requestedTenant.domain,
          operationalStatus: requestedTenant.operationalStatus,
          trialEndsAt: requestedTenant.trialEndsAt,
          featurePolicy: parseMasterDataFeaturePolicy(requestedTenant.settings),
        }
      : null,
    operation,
    now,
  });
}
