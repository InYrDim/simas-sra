import { eq } from "drizzle-orm";
import { BookOpen } from "lucide-react";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { ApplicationForm } from "@/app/apply/application-form";
import { db } from "@/db";
import { simasApplication } from "@/db/schema";
import { auth } from "@/lib/auth";
import { resolveCentralDestination } from "@/lib/central-identity";
import { getCentralIdentity } from "@/lib/central-identity-data";

export default async function ApplyPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return <AnonymousApply />;

  const identity = await getCentralIdentity(session.user.id);
  if (identity.kind !== "applicant") redirect(resolveCentralDestination(identity));
  const applications = await db
    .select({ id: simasApplication.id, status: simasApplication.status, schoolName: simasApplication.schoolName })
    .from(simasApplication)
    .where(eq(simasApplication.ownerUserId, session.user.id));

  return (
    <ApplyShell>
      <header className="mb-8">
        <p className="text-sm font-medium text-primary">Akun Pemohon</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">{session.user.name}</h1>
        <p className="mt-2 text-muted-foreground">{session.user.email}</p>
      </header>
      {applications.length === 0 ? (
        <section>
          <h2 className="text-xl font-semibold">Belum ada Pengajuan SIMAS</h2>
          <p className="mt-2 mb-8 text-muted-foreground">Buat Pengajuan pertama untuk menghubungkan akun ini dengan NPSN sekolah Anda.</p>
          <ApplicationForm />
        </section>
      ) : (
        <section>
          <h2 className="text-xl font-semibold">Riwayat Pengajuan</h2>
          <ul className="mt-4 space-y-3">{applications.map((item) => <li className="rounded-md border p-4" key={item.id}>{item.schoolName} — {item.status}</li>)}</ul>
        </section>
      )}
    </ApplyShell>
  );
}

function AnonymousApply() {
  return (
    <ApplyShell>
      <h1 className="text-3xl font-bold tracking-tight">Ajukan Tenant SIMAS untuk sekolah Anda</h1>
      <p className="mt-4 text-muted-foreground">Masuk dengan akun Pemohon atau daftar terlebih dahulu untuk membuat dan memantau Pengajuan SIMAS.</p>
      <div className="mt-8 flex gap-4">
        <Link className="rounded-md bg-primary px-4 py-2 text-primary-foreground" href="/login?intent=apply">Masuk</Link>
        <Link className="rounded-md border px-4 py-2" href="/register?intent=apply">Daftar sebagai Pemohon</Link>
      </div>
    </ApplyShell>
  );
}

function ApplyShell({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen bg-muted/30 px-4 py-10 sm:py-16"><div className="mx-auto max-w-3xl"><Link href="/" className="mb-8 inline-flex items-center gap-2 font-semibold"><BookOpen className="size-5 text-primary" />SIMAS</Link><div className="rounded-xl border bg-background p-6 shadow-sm sm:p-10">{children}</div></div></main>;
}
