import { notFound } from "next/navigation"

import { resolvePublicTenant } from "@/app/ppdb/[domain]/resolve-tenant"
import { PpdbStatusCheckForm } from "@/app/ppdb/[domain]/status/status-check-form"
import { findPpdbAnnouncementState } from "@/lib/ppdb-session-data"

export default async function PpdbSessionStatusPage({
  params,
}: {
  params: Promise<{ domain: string; sessionId: string }>
}) {
  const { domain, sessionId } = await params
  const tenant = await resolvePublicTenant(domain)
  if (!tenant) notFound()
  const announcement = await findPpdbAnnouncementState(tenant.id, sessionId)
  if (!announcement) notFound()

  if (announcement.status !== "ended") {
    return <AnnouncementNotice title="Pengumuman belum dibuka">Proses pendaftaran masih berlangsung. Silakan kembali setelah masa pendaftaran diakhiri oleh sekolah.</AnnouncementNotice>
  }
  if (!announcement.resultsPublishedAt) {
    return <AnnouncementNotice title="Pengumuman sedang disiapkan">Masa pendaftaran telah berakhir, tetapi hasil seleksi belum dipublikasikan oleh sekolah.</AnnouncementNotice>
  }
  if (announcement.resultCheckClosedAt) {
    return <AnnouncementNotice title="Cek status telah ditutup">Masa akses pengumuman PPDB ini telah ditutup oleh sekolah.</AnnouncementNotice>
  }

  return <PpdbStatusCheckForm domain={domain} sessionId={sessionId} nisnRequired={tenant.nisnRequired} />
}

function AnnouncementNotice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-slate-100 p-6">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">{children}</p>
      </section>
    </main>
  )
}
