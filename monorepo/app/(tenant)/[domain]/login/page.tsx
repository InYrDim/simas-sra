import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { TenantLoginForm } from "@/app/(tenant)/[domain]/login/tenant-login-form";
import { TenantNotFoundRedirect } from "@/app/(tenant)/[domain]/login/tenant-not-found-redirect";
import { auth } from "@/lib/platform/auth";
import { getCentralIdentity } from "@/lib/platform/central-identity-data";
import { resolveTenantLogin } from "@/lib/tenancy/tenant-login";
import { tenantLoginStore } from "@/lib/tenancy/tenant-login-data";

export default async function TenantLoginPage({ params, searchParams }: {
  params: Promise<{ domain: string }>;
  searchParams: Promise<{ continuation?: string | string[] }>;
}) {
  const { domain } = await params;
  const candidate = (await searchParams).continuation;
  const continuation = typeof candidate === "string" ? candidate : null;
  const session = await auth.api.getSession({ headers: await headers() });
  const result = await resolveTenantLogin(tenantLoginStore, domain, session ? await getCentralIdentity(session.user.id) : null, continuation);
  if (result.kind === "redirect") redirect(result.destination);

  return <main className="grid min-h-screen place-items-center px-4">
    <section className="w-full max-w-md rounded-xl border p-8">
      {result.kind === "tenant-not-found" ? <TenantNotFoundRedirect /> : <><h1 className="text-2xl font-semibold">Masuk ke {result.tenant.name}</h1><p className="mt-2 text-muted-foreground">Gunakan akun SIMAS Anda. Domain ini tidak memberikan akses tanpa membership Tenant.</p><TenantLoginForm domain={domain} continuation={result.continuation} /></>}
    </section>
  </main>;
}
