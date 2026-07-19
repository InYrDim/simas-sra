import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { TenantLoginForm } from "@/app/(tenant)/[domain]/login/tenant-login-form";
import { auth } from "@/lib/auth";
import { getCentralIdentity } from "@/lib/central-identity-data";
import { resolveTenantLogin } from "@/lib/tenant-login";
import { tenantLoginStore } from "@/lib/tenant-login-data";

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
      {result.kind === "tenant-not-found" ? <><h1 className="text-2xl font-semibold">Tenant tidak ditemukan</h1><p className="mt-3 text-muted-foreground">Periksa kembali domain sekolah yang Anda buka.</p></> : <><h1 className="text-2xl font-semibold">Masuk ke {result.tenant.name}</h1><p className="mt-2 text-muted-foreground">Gunakan akun SIMAS Anda. Domain ini tidak memberikan akses tanpa membership Tenant.</p><TenantLoginForm domain={domain} continuation={result.continuation} /></>}
    </section>
  </main>;
}
