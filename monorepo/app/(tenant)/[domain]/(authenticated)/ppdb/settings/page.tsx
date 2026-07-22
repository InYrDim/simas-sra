import Link from "next/link"

import { PpdbFieldBuilder } from "@/app/(tenant)/[domain]/(authenticated)/ppdb/settings/field-builder"
import { Button } from "@/components/ui/button"
import { CreateSessionForm } from "@/app/(tenant)/[domain]/(authenticated)/ppdb/create-session-form"
import { createAcademicYearService } from "@/lib/academic-year"
import { academicYearStore } from "@/lib/academic-year-data"
import { createPpdbSessionService } from "@/lib/ppdb-session"
import { ppdbSessionStore } from "@/lib/ppdb-session-data"
import { enforceMasterDataAccess } from "@/lib/tenant-master-data-route-access"
import { ArrowLeft, ExternalLink } from "lucide-react"

const sessionService = createPpdbSessionService({ store: ppdbSessionStore })
const academicYearService = createAcademicYearService({ store: academicYearStore })



export default async function PPDBSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ domain: string }>
  searchParams: Promise<{ result?: string }>
}) {
  const [{ domain }, raw] = await Promise.all([params, searchParams])
  const principal = await enforceMasterDataAccess(domain, "read")
  const [sessions, years] = await Promise.all([sessionService.list(principal), academicYearService.list(principal)])
  const current = sessions.find((session) => session.status === "published") ?? sessions.find((session) => session.status === "draft")
  const selectableYears = years.filter((year) => !year.archived && year.lifecycle !== "closed" && year.lifecycle !== "cancelled")
  const yearLabel = current ? years.find((year) => year.id === current.academicYearId)?.label ?? current.academicYearId : null

  return (
    <main className="min-h-svh bg-slate-50 text-slate-950 pb-20">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Sesi &amp; Form PPDB</h1>
          <p className="text-sm text-slate-500">
            Domain: {domain}
            {current ? ` • Tahun Ajaran ${yearLabel}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          {current?.status === "published" ? (
            <Button nativeButton={false} render={<Link href={`/apply/${domain}`} target="_blank" />} variant="outline" className="gap-1.5 border-sky-600 text-sky-700 hover:bg-sky-50 hover:text-sky-800">
              <ExternalLink className="size-4" />
              Lihat Form Publik
            </Button>
          ) : null}
          <Button nativeButton={false} render={<Link href={`/${domain}/ppdb`} />} variant="outline" className="gap-1.5 border-slate-400 text-slate-700 hover:bg-slate-100 hover:text-slate-900">
            <ArrowLeft className="size-4" />
            Kembali ke Dashboard
          </Button>
        </div>
      </header>

      {raw.result ? (
        <p role="status" className="mx-6 mt-4 rounded-lg border border-slate-200 bg-white p-3 text-sm">
          {raw.result === "saved" ? "Perubahan Sesi PPDB tersimpan." : `Perubahan ditolak: ${raw.result}.`}
        </p>
      ) : null}

      <div className="mx-auto max-w-4xl p-6">
        {!principal.capabilities.write ? (
          <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Tenant sedang hanya-baca; pengelolaan Sesi PPDB dinonaktifkan.</p>
        ) : !current ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <h2 className="font-bold text-lg mb-2">Buat Sesi PPDB</h2>
            <p className="text-sm text-slate-600 mb-6">
              Tentukan Tahun Ajaran dan tanggal berakhir pendaftaran. Tanggal ini hanya informasi bagi Calon Siswa — Sesi tetap terbuka sampai Anda menutupnya secara manual lewat &quot;Akhiri Sesi PPDB&quot;.
            </p>
            {selectableYears.length === 0 ? (
              <p className="text-sm text-red-600">
                Belum ada Tahun Ajaran yang bisa dipakai. Buat Tahun Ajaran terlebih dahulu lewat{" "}
                <Link href={`/${domain}/master/tahun-ajaran`} className="underline">
                  Master Data &gt; Tahun Ajaran
                </Link>
                .
              </p>
            ) : (
              <CreateSessionForm domain={domain} selectableYears={selectableYears.map((year) => ({ id: year.id, label: year.label }))} />
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {current.status === "published" ? (
              <p className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-800">
                Form publik tetap menggunakan versi yang sudah diterbitkan. Simpan perubahan sebagai draft, lalu klik Publikasikan Perubahan saat siap menampilkannya ke calon siswa.
              </p>
            ) : null}
            <PpdbFieldBuilder
              domain={domain}
              sessionId={current.id}
              initialFields={current.draftFields}
              publishedFields={current.fields}
              published={current.status === "published"}
            />
          </div>
        )}
      </div>
    </main>
  )
}
