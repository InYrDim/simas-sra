import Link from "next/link";
import { notFound } from "next/navigation";

import { ResetCredentialForm } from "@/app/(provider)/provider/tenants/[tenantId]/reset-credential-form";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getProviderTenantDetail } from "@/lib/provider-tenant-data";
import { tenantUsageStageLabel } from "@/lib/provider-tenants";

export default async function ProviderTenantDetailPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const detail = await getProviderTenantDetail(tenantId);
  if (!detail) notFound();
  const hasTemporaryCredential = detail.temporaryCredentialActivationUserId !== null;
  const canReset = hasTemporaryCredential && !detail.firstAuthenticatedAt && detail.passwordChangeRequired;
  const usage = tenantUsageStageLabel(detail);

  return (
    <div className="space-y-6">
      <div>
        <Link className={buttonVariants({ variant: "link", size: "sm" })} href="/provider/tenants">← Kembali ke Tenant</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold">{detail.tenantName}</h1>
          <Badge variant="outline">{usage.label}</Badge>
        </div>
        <p className="text-muted-foreground">{detail.domain}</p>
        <Link className={buttonVariants({ variant: "outline", size: "sm", className: "mt-3" })} href={`/${detail.domain}`} rel="noopener noreferrer" target="_blank">
          Buka situs Tenant
        </Link>
      </div>

      <Card>
        <CardHeader><CardTitle>Identitas dan lifecycle Tenant</CardTitle></CardHeader>
        <CardContent><dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Nama sekolah" value={detail.tenantName} />
          <Field label="NPSN" value={detail.npsn ?? "—"} />
          <Field label="Subdomain" value={detail.domain} />
          <Field label="Tanggal persetujuan" value={formatDate(detail.approvedAt)} />
          <Field label="Onboarding selesai" value={formatDate(detail.onboardingCompletedAt)} />
          <Field label="Trial dimulai" value={formatDate(detail.trialStartedAt)} />
          <Field label="Trial berakhir" value={formatDate(detail.trialEndsAt)} />
        </dl></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>School Admin pertama</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Nama" value={detail.schoolAdminName} />
            <Field label="Email" value={detail.schoolAdminEmail} />
            <Field label="Email terverifikasi" value={detail.schoolAdminEmailVerified ? "Ya" : "Belum"} />
            {hasTemporaryCredential ? (
              <>
                <Field label="Status Kredensial sementara" value={detail.firstAuthenticatedAt ? "Sudah login" : "Menunggu login pertama"} />
                <Field label="Login pertama" value={formatDate(detail.firstAuthenticatedAt, true)} />
                <Field label="Kredensial diterbitkan" value={formatDate(detail.temporaryCredentialIssuedAt, true)} />
              </>
            ) : null}
          </dl>
          {canReset ? (
            <ResetCredentialForm userId={detail.schoolAdminUserId} />
          ) : hasTemporaryCredential ? (
            <p className="rounded-md border p-3 text-sm">
              Reset Kredensial sementara tidak tersedia setelah login pertama. Arahkan School Admin ke{" "}
              <Link className="text-primary underline" href="/forgot-password">pemulihan kata sandi biasa</Link>.
            </p>
          ) : (
            <p className="rounded-md border p-3 text-sm text-muted-foreground">
              School Admin ini menggunakan akun yang sudah dimiliki dan tidak mempunyai Kredensial sementara.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Pengajuan SIMAS asal</CardTitle></CardHeader>
        <CardContent>
          {detail.applicationId ? <div className="space-y-4">
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Sekolah saat diajukan" value={detail.applicationSchoolName ?? "—"} />
              <Field label="NPSN saat diajukan" value={detail.applicationNpsn ?? "—"} />
              <Field label="Jenjang" value={detail.applicationEducationLevel ?? "—"} />
              <Field label="Dikirim" value={formatDate(detail.applicationSubmittedAt)} />
              <Field label="Penanggung jawab" value={detail.applicationContactName ?? "—"} />
              <Field label="Jabatan" value={detail.applicationContactPosition ?? "—"} />
              <Field label="Email" value={detail.applicationContactEmail ?? "—"} />
              <Field label="WhatsApp" value={detail.applicationContactWhatsapp ?? "—"} />
              <Field label="Alamat" value={detail.applicationAddress ?? "—"} />
              <Field label="Catatan kebutuhan" value={detail.applicationNeedsNote ?? "—"} />
            </dl>
            <Link className={buttonVariants({ variant: "outline", size: "sm" })} href={`/provider/tenants/applications/${detail.applicationId}`}>Lihat Pengajuan lengkap</Link>
          </div> : <p className="text-sm text-muted-foreground">Pengajuan SIMAS asal tidak tersedia.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function formatDate(value: Date | null, includeTime = false) {
  if (!value) return "Belum";
  return includeTime
    ? value.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })
    : value.toLocaleDateString("id-ID", { dateStyle: "medium" });
}

function Field({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs uppercase text-muted-foreground">{label}</dt><dd className="mt-1 whitespace-pre-wrap text-sm">{value}</dd></div>;
}
