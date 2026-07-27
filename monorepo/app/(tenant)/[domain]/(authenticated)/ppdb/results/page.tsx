import Link from "next/link"
import { notFound } from "next/navigation"

import { PpdbResultSettingsForm } from "@/app/(tenant)/[domain]/(authenticated)/ppdb/result-settings-form"
import { Button } from "@/components/ui/button"
import { createAcademicYearService } from "@/lib/academic-year"
import { academicYearStore } from "@/lib/academic-year-data"
import { createPpdbSessionService } from "@/lib/ppdb-session"
import { ppdbSessionStore } from "@/lib/ppdb-session-data"
import { enforceMasterDataAccess } from "@/lib/tenant-master-data-route-access"

const sessionService = createPpdbSessionService({ store: ppdbSessionStore })
const academicYearService = createAcademicYearService({ store: academicYearStore })

const resultMessages: Record<string, string> = {
  saved: "Pengaturan hasil PPDB tersimpan.",
  published: "Hasil PPDB berhasil dipublikasikan.",
  "invalid-input": "Pengaturan hasil belum valid. Periksa kembali seluruh isian.",
  "invalid-result-settings": "Pengaturan hasil belum valid. Gunakan tautan grup chat.whatsapp.com dan batasi setiap pesan hingga 2.000 karakter.",
  "not-found": "Sesi PPDB tidak ditemukan.",
  "session-not-ended": "Hasil hanya dapat dipublikasikan setelah sesi diakhiri.",
  "result-feedback-required": "Lengkapi umpan balik hasil sebelum mempublikasikan.",
  "pending-submissions": "Semua pendaftaran harus diputuskan sebelum hasil dipublikasikan.",
  "results-already-published": "Hasil sesi ini sudah dipublikasikan.",
  "result-settings-locked": "Pengaturan hasil yang sudah dipublikasikan tidak dapat diubah.",
  error: "Perubahan hasil PPDB belum dapat disimpan.",
}

export default async function PPDBResultsPage({
  params,
  searchParams,
}: {
  params: Promise<{ domain: string }>
  searchParams: Promise<{ sessionId?: string; result?: string }>
}) {
  const [{ domain }, raw] = await Promise.all([params, searchParams])
  const principal = await enforceMasterDataAccess(domain, "read")
  const [sessions, years] = await Promise.all([sessionService.list(principal), academicYearService.list(principal)])
  const ended = sessions
    .filter((item) => item.status === "ended")
    .sort((a, b) => (b.endedAt?.getTime() ?? 0) - (a.endedAt?.getTime() ?? 0))
  const session = raw.sessionId
    ? sessions.find((item) => item.id === raw.sessionId)
    : ended[0] ?? sessions.find((item) => item.status === "published")
  if (!session) notFound()

  const yearLabel = years.find((year) => year.id === session.academicYearId)?.label ?? session.academicYearId
  const resultCode = typeof raw.result === "string" && raw.result in resultMessages ? raw.result : undefined

  return (
    <main className="min-h-svh bg-slate-50 pb-20 text-slate-950">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-4">
        <div>
          <h1 className="text-xl font-bold">Konfigurasi Hasil PPDB</h1>
          <p className="text-sm text-slate-500">Domain: {domain} • Tahun Ajaran {yearLabel}</p>
        </div>
        <div className="flex gap-2">
          {session.status === "ended" ? (
            <Button nativeButton={false} render={<Link href={`/${domain}/ppdb/riwayat/${session.id}`} />} variant="outline">
              Detail Sesi
            </Button>
          ) : null}
          <Button nativeButton={false} render={<Link href={`/${domain}/ppdb`} />} variant="outline">
            Kembali ke Dashboard
          </Button>
        </div>
      </header>

      {resultCode ? (
        <p role={resultCode === "saved" || resultCode === "published" ? "status" : "alert"} className="mx-auto mt-4 max-w-4xl rounded-lg border border-slate-200 bg-white p-3 text-sm">
          {resultMessages[resultCode]}
        </p>
      ) : null}

      <div className="mx-auto max-w-4xl p-6">
        <PpdbResultSettingsForm domain={domain} session={session} writable={principal.capabilities.write} />
      </div>
    </main>
  )
}
