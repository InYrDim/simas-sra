import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { getCentralIdentity } from "@/lib/central-identity-data";
import { resolveTenantLogin } from "@/lib/tenant-login";
import { tenantLoginStore } from "@/lib/tenant-login-data";

export default async function ContinueTenantLoginPage({ params, searchParams }: {
  params: Promise<{ domain: string }>;
  searchParams: Promise<{ continuation?: string | string[] }>;
}) {
  const { domain } = await params;
  const candidate = (await searchParams).continuation;
  const continuation = typeof candidate === "string" ? candidate : null;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    const query = continuation ? `?continuation=${encodeURIComponent(continuation)}` : "";
    redirect(`/${domain}/login${query}`);
  }
  const result = await resolveTenantLogin(tenantLoginStore, domain, await getCentralIdentity(session.user.id), continuation);
  if (result.kind === "tenant-not-found") redirect(`/${domain}/login`);
  if (result.kind === "redirect") redirect(result.destination);
  redirect(`/${domain}/login`);
}
