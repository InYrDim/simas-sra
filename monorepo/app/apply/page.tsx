import { randomUUID } from "node:crypto";

import { BookOpen } from "lucide-react";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { ApplicationForm } from "@/app/apply/application-form";
import { auth } from "@/lib/auth";
import { createApplicantPortalQuery, type ApplicantApplicationSnapshot } from "@/lib/applicant-portal";
import { applicantPortalStore } from "@/lib/applicant-portal-data";
import { resolveCentralDestination } from "@/lib/central-identity";
import { getCentralIdentity } from "@/lib/central-identity-data";

export default async function ApplyPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return <AnonymousApply />;

  const identity = await getCentralIdentity(session.user.id);
  if (identity.kind !== "applicant") redirect(resolveCentralDestination(identity));

  const portal = await createApplicantPortalQuery(applicantPortalStore)(session.user.id);
  if (!portal.ok) redirect(resolveCentralDestination(identity));

  return (
    <ApplyShell>
      <header className="mb-8">
        <p className="text-sm font-medium text-primary">Akun Pemohon</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">{session.user.name}</h1>
        <p className="mt-2 text-muted-foreground">{session.user.email}</p>
      </header>
      {portal.state.kind === "empty" ? (
        <section>
          <h2 className="text-xl font-semibold">Belum ada Pengajuan SIMAS</h2>
          <p className="mt-2 mb-8 text-muted-foreground">Buat Pengajuan pertama untuk menghubungkan akun ini secara permanen dengan NPSN sekolah Anda.</p>
          <ApplicationForm idempotencyKey={randomUUID()} />
        </section>
      ) : portal.state.kind === "pending" ? (
        <PendingApplication current={portal.state.current} history={portal.state.history} />
      ) : portal.state.kind === "rejected" ? (
        <RejectedApplication current={portal.state.current} history={portal.state.history} />
      ) : (
        <ApplicationHistory history={portal.state.history} />
      )}
    </ApplyShell>
  );
}

function PendingApplication({ current, history }: { current: ApplicantApplicationSnapshot; history: readonly ApplicantApplicationSnapshot[] }) {
  return (
    <section className="space-y-8">
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-5" role="status">
        <p className="text-sm font-medium text-primary">Status: Menunggu peninjauan Provider</p>
        <h2 className="mt-2 text-xl font-semibold">Pengajuan #{current.id}</h2>
        <p className="mt-2 text-sm text-muted-foreground">Snapshot ini bersifat tetap dan tidak dapat diedit atau dibatalkan.</p>
      </div>
      <Snapshot application={current} />
      <ApplicationHistory history={history} />
    </section>
  );
}

function RejectedApplication({ current, history }: { current: ApplicantApplicationSnapshot; history: readonly ApplicantApplicationSnapshot[] }) {
  return (
    <section className="space-y-8">
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-5" role="status">
        <p className="text-sm font-medium text-destructive">Status: Ditolak</p>
        <h2 className="mt-2 text-xl font-semibold">Percobaan {current.attemptNumber}</h2>
        <p className="mt-3 font-medium">Alasan Provider</p>
        <p className="mt-1 text-sm">{current.rejectionReason}</p>
        <p className="mt-2 text-xs text-muted-foreground">Snapshot yang ditolak tetap tersimpan dan tidak akan diubah oleh pengajuan baru.</p>
      </div>
      <Snapshot application={current} />
      <ApplicationHistory history={history} />
      <div>
        <h3 className="text-lg font-semibold">Ajukan kembali</h3>
        <p className="mt-2 mb-6 text-sm text-muted-foreground">Perbaiki data yang diperlukan. NPSN tetap terikat ke akun ini.</p>
        <ApplicationForm idempotencyKey={randomUUID()} initial={current} />
      </div>
    </section>
  );
}

function Snapshot({ application }: { application: ApplicantApplicationSnapshot }) {
  const fields = [
    ["Nama resmi sekolah", application.schoolName], ["NPSN", application.npsn], ["Jenjang", application.educationLevel],
    ["Alamat", application.address], ["Penanggung jawab", application.contactName], ["Jabatan", application.contactPosition],
    ["Email kontak", application.contactEmail], ["WhatsApp", application.contactWhatsapp], ["Catatan kebutuhan", application.needsNote ?? "—"],
  ];
  return <div><h3 className="text-lg font-semibold">Snapshot Pengajuan</h3><dl className="mt-4 grid gap-4 sm:grid-cols-2">{fields.map(([label, value]) => <div className="rounded-md border p-3" key={label}><dt className="text-xs font-medium text-muted-foreground">{label}</dt><dd className="mt-1 text-sm">{value}</dd></div>)}</dl></div>;
}

function ApplicationHistory({ history }: { history: readonly ApplicantApplicationSnapshot[] }) {
  return <div><h3 className="text-lg font-semibold">Riwayat Pengajuan</h3><ol className="mt-4 space-y-3">{history.map((item) => <li className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-4" key={item.id}><div><p className="font-medium">Percobaan {item.attemptNumber} · #{item.id}</p><p className="text-sm text-muted-foreground">{item.schoolName} · {item.submittedAt.toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" })}</p></div><span className="rounded-full border px-3 py-1 text-xs font-medium capitalize">{item.status}</span></li>)}</ol></div>;
}

function AnonymousApply() {
  return <ApplyShell><h1 className="text-3xl font-bold tracking-tight">Ajukan Tenant SIMAS untuk sekolah Anda</h1><p className="mt-4 text-muted-foreground">Masuk dengan akun Pemohon atau daftar terlebih dahulu untuk membuat dan memantau Pengajuan SIMAS.</p><div className="mt-8 flex gap-4"><Link className="rounded-md bg-primary px-4 py-2 text-primary-foreground" href="/login?intent=apply">Masuk</Link><Link className="rounded-md border px-4 py-2" href="/register?intent=apply">Daftar sebagai Pemohon</Link></div></ApplyShell>;
}

function ApplyShell({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen bg-muted/30 px-4 py-10 sm:py-16"><div className="mx-auto max-w-3xl"><Link href="/" className="mb-8 inline-flex items-center gap-2 font-semibold"><BookOpen className="size-5 text-primary" />SIMAS</Link><div className="rounded-xl border bg-background p-6 shadow-sm sm:p-10">{children}</div></div></main>;
}
