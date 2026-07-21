import Link from "next/link"

import { Button } from "@/components/ui/button"
import { createAcademicYearService } from "@/lib/academic-year"
import { academicYearStore } from "@/lib/academic-year-data"
import { createPpdbSessionService } from "@/lib/ppdb-session"
import { ppdbSessionStore } from "@/lib/ppdb-session-data"
import { enforceMasterDataAccess } from "@/lib/tenant-master-data-route-access"

const sessionService = createPpdbSessionService({ store: ppdbSessionStore })
const academicYearService = createAcademicYearService({ store: academicYearStore })

export default async function PPDBHistoryPage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params
  const principal = await enforceMasterDataAccess(domain, "read")
  const [sessions, years] = await Promise.all([sessionService.list(principal), academicYearService.list(principal)])
  const ended = sessions.filter((session) => session.status === "ended").sort((a, b) => (b.endedAt?.getTime() ?? 0) - (a.endedAt?.getTime() ?? 0))

  return (
    <main className="min-h-svh bg-slate-50 text-slate-950 pb-20">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Riwayat PPDB</h1>
          <p className="text-sm text-slate-500">Domain: {domain}</p>
        </div>
        <Button nativeButton={false} render={<Link href={`/${domain}/ppdb`} />} variant="outline">
          Kembali ke Dashboard
        </Button>
      </header>

      <div className="p-6">
        <div className="mx-auto max-w-4xl">
          {ended.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
              <p className="text-sm text-slate-500">Belum ada Sesi PPDB yang diakhiri.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {ended.map((session) => {
                const label = years.find((year) => year.id === session.academicYearId)?.label ?? session.academicYearId
                return (
                  <li key={session.id}>
                    <Link
                      href={`/${domain}/ppdb/riwayat/${session.id}`}
                      className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-sky-300"
                    >
                      <p className="font-semibold text-slate-900">Tahun Ajaran {label}</p>
                      <p className="text-sm text-slate-500">
                        Diakhiri {session.endedAt?.toLocaleString("id-ID")} • Berakhir (rencana) {session.endDate}
                      </p>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </main>
  )
}
