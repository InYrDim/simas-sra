import Link from "next/link";
import { notFound } from "next/navigation";

import { ResetCredentialForm } from "@/app/(provider)/provider/tenants/[tenantId]/reset-credential-form";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getProviderTenantActivation } from "@/lib/provider-tenant-data";

export default async function ProviderTenantDetailPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const detail = await getProviderTenantActivation(tenantId);
  if (!detail) notFound();
  const canReset = !detail.firstAuthenticatedAt && detail.passwordChangeRequired;

  return (
    <div className="space-y-6">
      <div>
        <Link className={buttonVariants({ variant: "link", size: "sm" })} href="/provider/tenants">← Kembali ke Tenant</Link>
        <h1 className="mt-2 text-3xl font-semibold">{detail.tenantName}</h1>
        <p className="text-muted-foreground">{detail.domain}</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Aktivasi School Admin</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-4 sm:grid-cols-2">
            <Field label="Email" value={detail.schoolAdminEmail} />
            <Field label="Login pertama" value={detail.firstAuthenticatedAt?.toLocaleString("id-ID") ?? "Belum"} />
            <Field label="Wajib ganti kata sandi" value={detail.passwordChangeRequired ? "Ya" : "Tidak"} />
            <Field label="Kredensial diterbitkan" value={detail.temporaryCredentialIssuedAt.toLocaleString("id-ID")} />
          </dl>
          {canReset ? (
            <ResetCredentialForm userId={detail.schoolAdminUserId} />
          ) : (
            <p className="rounded-md border p-3 text-sm">
              Reset kredensial sementara tidak tersedia setelah login pertama. Arahkan School Admin ke{" "}
              <Link className="text-primary underline" href="/forgot-password">pemulihan kata sandi Better Auth</Link>.
            </p>
          )}
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        Aktivasi tidak memulai Trial Tenant atau menyelesaikan Onboarding Tenant.
      </p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs uppercase text-muted-foreground">{label}</dt><dd className="mt-1 text-sm">{value}</dd></div>;
}
