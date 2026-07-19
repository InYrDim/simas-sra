import "server-only";

import { and, eq, isNull } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { providerAdmin, user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { resolveCentralDestination } from "@/lib/central-identity";
import { getCentralIdentity } from "@/lib/central-identity-data";

export type ProviderPrincipal = Readonly<{
  userId: string;
  name: string;
  email: string;
}>;

export type ProviderAccess =
  | { status: "unauthenticated" }
  | { status: "forbidden"; userId: string }
  | { status: "authorized"; principal: ProviderPrincipal };

export class ProviderAuthorizationError extends Error {
  readonly status: 401 | 403;

  constructor(status: 401 | 403) {
    super(status === 401 ? "Provider authentication required" : "Provider access forbidden");
    this.name = "ProviderAuthorizationError";
    this.status = status;
  }
}

export async function getProviderAccess(): Promise<ProviderAccess> {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return { status: "unauthenticated" };
  }

  const [principal] = await db
    .select({
      userId: user.id,
      name: user.name,
      email: user.email,
    })
    .from(providerAdmin)
    .innerJoin(
      user,
      and(
        eq(user.id, providerAdmin.userId),
        eq(user.id, session.user.id),
        isNull(user.tenantId),
      ),
    )
    .limit(1);

  if (!principal) {
    return { status: "forbidden", userId: session.user.id };
  }

  return { status: "authorized", principal };
}

export async function getProviderPageAccess(): Promise<
  { status: "authorized"; principal: ProviderPrincipal }
> {
  const access = await getProviderAccess();

  if (access.status === "unauthenticated") redirect("/login");
  if (access.status === "forbidden") {
    redirect(resolveCentralDestination(await getCentralIdentity(access.userId)));
  }
  return access;
}

export async function getProviderRouteAccess(): Promise<
  | { response: Response; principal?: never }
  | { response?: never; principal: ProviderPrincipal }
> {
  const access = await getProviderAccess();

  if (access.status === "unauthenticated") {
    return { response: Response.json({ error: "unauthenticated" }, { status: 401 }) };
  }

  if (access.status === "forbidden") {
    return { response: Response.json({ error: "forbidden" }, { status: 403 }) };
  }

  return { principal: access.principal };
}

export async function requireProviderActionAccess(): Promise<ProviderPrincipal> {
  return requireProviderAccess();
}

export async function requireProviderDataAccess(): Promise<ProviderPrincipal> {
  return requireProviderAccess();
}

async function requireProviderAccess(): Promise<ProviderPrincipal> {
  const access = await getProviderAccess();

  if (access.status === "unauthenticated") {
    throw new ProviderAuthorizationError(401);
  }

  if (access.status === "forbidden") {
    throw new ProviderAuthorizationError(403);
  }

  return access.principal;
}
