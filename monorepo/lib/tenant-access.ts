import "server-only";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { db } from "@/db";
import { tenant } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getCentralIdentity } from "@/lib/central-identity-data";
import { resolveTenantPageAccess } from "@/lib/tenant-login";
import { TENANT_PATHNAME_HEADER } from "@/lib/proxy-routing";
import { tenantLoginStore } from "@/lib/tenant-login-data";
import { requireActivatedTenantPrincipal, TenantActivationError } from "@/lib/temporary-credential-activation";
import { temporaryCredentialActivationStore } from "@/lib/temporary-credential-activation-data";

export async function getTenantPageAccess(domain: string, continuation?: string | null) {
  const session = await auth.api.getSession({ headers: await headers() });
  const identity = session ? await getCentralIdentity(session.user.id) : null;
  const access = await resolveTenantPageAccess(tenantLoginStore, domain, identity, continuation);
  if (access.kind !== "authorized" || !session) return access;

  try {
    await requireActivatedTenantPrincipal(session.user.id, access.tenant.id, temporaryCredentialActivationStore);
    return access;
  } catch (error) {
    if (!(error instanceof TenantActivationError)) throw error;
    if (error.code === "password-change-required") {
      return { kind: "redirect", destination: "/change-password" } as const;
    }
    return { kind: "redirect", destination: "/access-error" } as const;
  }
}

export async function enforceTenantPageAccess(domain: string) {
  const continuation = (await headers()).get(TENANT_PATHNAME_HEADER);
  const access = await getTenantPageAccess(domain, continuation);
  if (access.kind === "tenant-not-found") notFound();
  if (access.kind === "login-required" || access.kind === "redirect") redirect(access.destination);
  return access.tenant;
}

export async function requireTenantFeatureAccess(domain: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new TenantActivationError("forbidden");

  const [tenantData] = await db
    .select({ id: tenant.id })
    .from(tenant)
    .where(eq(tenant.domain, domain))
    .limit(1);
  if (!tenantData) throw new TenantActivationError("forbidden");

  return requireActivatedTenantPrincipal(
    session.user.id,
    tenantData.id,
    temporaryCredentialActivationStore
  );
}
