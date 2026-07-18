import Link from "next/link";
import { notFound } from "next/navigation";

import { rejectSimasApplicationAction } from "@/app/(provider)/provider/tenants/applications/actions";
import { ApprovalForm } from "@/app/(provider)/provider/tenants/applications/[applicationId]/approval-form";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { getProviderApplicationDetail } from "@/lib/provider-application-data";
import {
  APPLICATION_STATUS_LABELS,
  suggestSubdomain,
} from "@/lib/provider-applications";

function matchLabels(
  target: { npsn: string; contactEmail: string },
  conflict: { npsn: string | null; contactEmail?: string | null },
) {
  const matches = [];
  if (conflict.npsn === target.npsn) matches.push("NPSN sama");
  if (conflict.contactEmail === target.contactEmail) {
    matches.push("email sama");
  }
  return matches.join(" dan ");
}

export default async function ProviderApplicationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ applicationId: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { applicationId } = await params;
  const [detail, messages] = await Promise.all([
    getProviderApplicationDetail(applicationId),
    searchParams,
  ]);
  if (!detail) notFound();

  const { application, applicationConflicts, tenantConflicts, decisionMaker } = detail;
  const rejectAction = rejectSimasApplicationAction.bind(null, application.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link className={buttonVariants({ variant: "link", size: "sm" })} href="/provider/tenants?tab=applications">
            ← Kembali ke Pengajuan SIMAS
          </Link>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{application.schoolName}</h1>
          <p className="mt-1 text-muted-foreground">Tinjau data asli dan konflik Pengajuan SIMAS.</p>
        </div>
        <Badge variant={application.status === "rejected" ? "destructive" : "outline"}>
          {APPLICATION_STATUS_LABELS[application.status]}
        </Badge>
      </div>

      {messages.error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          {messages.error}
        </p>
      ) : null}
      {messages.success === "rejected" ? (
        <p className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm" role="status">
          Pengajuan SIMAS berhasil ditolak. Keputusan ini tidak dapat diubah.
        </p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(20rem,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Data asli Pengajuan SIMAS</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
                <Field label="Nama resmi sekolah" value={application.schoolName} />
                <Field label="NPSN" value={application.npsn} />
                <Field label="Jenjang" value={application.educationLevel} />
                <Field label="Tanggal dikirim" value={application.submittedAt.toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" })} />
                <Field className="sm:col-span-2" label="Alamat" value={application.address} />
                <Field label="Nama penanggung jawab" value={application.contactName} />
                <Field label="Jabatan" value={application.contactPosition} />
                <Field label="Email" value={application.contactEmail} />
                <Field label="WhatsApp" value={application.contactWhatsapp} />
                <Field className="sm:col-span-2" label="Catatan kebutuhan" value={application.needsNote ?? "Tidak ada catatan"} />
              </dl>
              <p className="mt-6 text-xs text-muted-foreground">Data asli Pengajuan SIMAS bersifat tetap dan tidak dapat diedit.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Konflik saat ini</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {applicationConflicts.length === 0 && tenantConflicts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Tidak ada Pengajuan SIMAS lain atau Tenant dengan NPSN maupun email yang sama.</p>
              ) : null}
              {applicationConflicts.map((conflict) => (
                <div className="rounded-lg border p-4 text-sm" key={conflict.id}>
                  <div className="flex flex-wrap justify-between gap-2">
                    <p className="font-medium">Pengajuan SIMAS: {conflict.schoolName}</p>
                    <Badge variant="outline">{APPLICATION_STATUS_LABELS[conflict.status]}</Badge>
                  </div>
                  <p className="mt-1 text-destructive">{matchLabels(application, conflict)}</p>
                  <Link className="mt-2 inline-block text-primary underline-offset-4 hover:underline" href={`/provider/tenants/applications/${conflict.id}`}>
                    Lihat Pengajuan SIMAS
                  </Link>
                </div>
              ))}
              {tenantConflicts.map((conflict) => (
                <div className="rounded-lg border p-4 text-sm" key={conflict.id}>
                  <p className="font-medium">Tenant: {conflict.schoolName}</p>
                  <p className="mt-1 text-destructive">{matchLabels(application, conflict)}</p>
                  <Link className="mt-2 inline-block text-primary underline-offset-4 hover:underline" href={`/provider/tenants/${conflict.id}`}>
                    Lihat Tenant
                  </Link>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader><CardTitle>Keputusan</CardTitle></CardHeader>
          <CardContent>
            {application.status === "pending" ? (
              <div className="space-y-6">
                <ApprovalForm
                  applicationId={application.id}
                  defaultSubdomain={suggestSubdomain(application.schoolName)}
                />
                <div className="border-t pt-6">
                  <form action={rejectAction} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium" htmlFor="reason">Alasan penolakan</label>
                      <Textarea id="reason" name="reason" placeholder="Jelaskan alasan Pengajuan SIMAS ditolak" required />
                    </div>
                    <p className="text-xs text-muted-foreground">Penolakan bersifat permanen dan tidak membuat Tenant atau akun apa pun.</p>
                    <Button className="w-full" type="submit" variant="destructive">Tolak Pengajuan SIMAS</Button>
                  </form>
                </div>
              </div>
            ) : (
              <dl className="space-y-4">
                <Field label="Status" value={APPLICATION_STATUS_LABELS[application.status]} />
                <Field label="Diputuskan pada" value={application.decidedAt?.toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" }) ?? "—"} />
                <Field label="Provider Admin" value={decisionMaker ? `${decisionMaker.name} (${decisionMaker.email})` : application.decidedByProviderAdminId ?? "—"} />
                {application.status === "rejected" ? <Field label="Alasan penolakan" value={application.rejectionReason ?? "—"} /> : null}
                {application.status === "approved" && application.approvedTenantId ? (
                  <Link className={buttonVariants({ className: "w-full" })} href={`/provider/tenants/${application.approvedTenantId}`}>
                    Lihat Tenant
                  </Link>
                ) : null}
                <p className="text-xs text-muted-foreground">Keputusan terminal tidak dapat diedit, dibuka kembali, dibatalkan, atau diubah.</p>
              </dl>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap text-sm">{value}</dd>
    </div>
  );
}
