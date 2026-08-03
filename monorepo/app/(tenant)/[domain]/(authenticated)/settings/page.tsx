import Link from "next/link";

import { LandingPageForm } from "@/app/(tenant)/[domain]/(authenticated)/settings/landing-page-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getTenantLandingPageSettings } from "@/lib/tenancy/tenant-landing-page-data";
import { createHttpTenantAuthorizationEvaluator } from "@/lib/authorization/tenant-authorization-data";
import { enforceAuthorizedTenantOperation } from "@/lib/authorization/tenant-operation-route-access";

export default async function TenantSettingsPage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params;
  const evaluator = await createHttpTenantAuthorizationEvaluator();
  const view = await evaluator.evaluate({ surface: "page", domain, operationId: "tenant-settings.landing-page.load" });
  const principal = enforceAuthorizedTenantOperation(view, { domain, operationId: "tenant-settings.landing-page.load" });
  const [settings, update] = await Promise.all([
    getTenantLandingPageSettings(principal.tenantId),
    evaluator.evaluate({ surface: "page", domain, operationId: "tenant-settings.landing-page.update" }),
  ]);
  const loginUrl = "/login";
  const ppdbUrl = "/ppdb";

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pengaturan Sistem</h1>
          <p className="mt-2 text-muted-foreground">Atur HTML landing page publik khusus Tenant.</p>
        </div>
        <Button nativeButton={false} render={<Link href={`/${domain}`} target="_blank" />} variant="outline">
          Buka landing page
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>URL untuk landing page</CardTitle>
          <CardDescription>Gunakan URL berikut sebagai nilai atribut <code>href</code> pada tautan di HTML Anda.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border bg-muted/40 p-4">
            <p className="mb-2 text-sm font-medium">Halaman login SIMAS</p>
            <code className="block overflow-x-auto rounded-md bg-background p-3 text-xs">{loginUrl}</code>
          </div>
          <div className="rounded-xl border bg-muted/40 p-4">
            <p className="mb-2 text-sm font-medium">Pendaftaran PPDB</p>
            <code className="block overflow-x-auto rounded-md bg-background p-3 text-xs">{ppdbUrl}</code>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>HTML landing page</CardTitle>
          <CardDescription>
            HTML ditampilkan dalam lingkungan terisolasi tanpa akses ke cookie, penyimpanan, atau halaman induk SIMAS. JavaScript eksternal seperti Tailwind CDN tetap dapat digunakan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {update.kind === "authorized" ? (
            <LandingPageForm domain={domain} initialHtml={settings?.html ?? ""} />
          ) : (
            <p className="text-sm text-muted-foreground">Tenant sedang hanya-baca; landing page tidak dapat diubah.</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
