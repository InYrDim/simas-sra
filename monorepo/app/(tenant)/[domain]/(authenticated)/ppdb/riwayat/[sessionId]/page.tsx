import Link from "next/link"
import { notFound } from "next/navigation"

import { SubmissionsTable } from "@/app/(tenant)/[domain]/(authenticated)/ppdb/submissions-table"
import { Button } from "@/components/ui/button"
import { createAcademicYearService } from "@/lib/academic/academic-year"
import { academicYearStore } from "@/lib/academic/academic-year-data"
import { createPpdbSessionService } from "@/lib/admissions/ppdb-session"
import { ppdbSessionStore } from "@/lib/admissions/ppdb-session-data"
import { createPpdbSubmissionService } from "@/lib/admissions/ppdb-submission"
import { ppdbSubmissionStore } from "@/lib/admissions/ppdb-submission-data"
import { getTenantFeatureAvailability } from "@/lib/features/tenant-feature-access-data"
import { enforceMasterDataAccess } from "@/lib/master-data/tenant-master-data-route-access"

const sessionService = createPpdbSessionService({ store: ppdbSessionStore })
const submissionService = createPpdbSubmissionService({ store: ppdbSubmissionStore })
const academicYearService = createAcademicYearService({ store: academicYearStore })

export default async function PPDBHistoryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ domain: string; sessionId: string }>
  searchParams: Promise<{ result?: string }>
}) {
  const [{ domain, sessionId }, raw] = await Promise.all([params, searchParams])
  const principal = await enforceMasterDataAccess(domain, "read")
  const [availability, sessions, years, submissions] = await Promise.all([
    getTenantFeatureAvailability(principal.tenantId, principal.capabilities),
    sessionService.list(principal),
    academicYearService.list(principal),
    submissionService.list(principal, sessionId),
  ])
  const session = sessions.find((item) => item.id === sessionId && item.status === "ended")
  if (!session) notFound()
  const yearLabel = years.find((year) => year.id === session.academicYearId)?.label ?? session.academicYearId

  return (
    <main className="min-h-svh bg-slate-50 text-slate-950">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Riwayat PPDB &mdash; Tahun Ajaran {yearLabel}</h1>
          <p className="text-sm text-slate-500">
            Domain: {domain} • Diakhiri {session.endedAt?.toLocaleString("id-ID")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button nativeButton={false} render={<Link href={`/${domain}/ppdb/results?sessionId=${sessionId}`} />} featureAvailability={availability.ppdbWrite}>
            Konfigurasi Hasil
          </Button>
          <Button nativeButton={false} render={<Link href={`/${domain}/ppdb/riwayat`} />} variant="outline">
            Kembali ke Riwayat
          </Button>
        </div>
      </header>

      {raw.result ? (
        <p role="status" className="mx-6 mt-4 rounded-lg border border-slate-200 bg-white p-3 text-sm">
          {raw.result === "saved" ? "Perubahan tersimpan." : `Perubahan ditolak: ${raw.result}.`}
        </p>
      ) : null}

      <div className="p-6">
        <div className="mx-auto max-w-6xl rounded-xl border border-slate-200 bg-white shadow-sm overflow-auto">
          <SubmissionsTable
            domain={domain}
            submissions={submissions}
            writable={principal.capabilities.write}
            redirectPath={`/${domain}/ppdb/riwayat/${sessionId}`}
            availability={availability.ppdbWrite}
          />
        </div>
      </div>
    </main>
  )
}
