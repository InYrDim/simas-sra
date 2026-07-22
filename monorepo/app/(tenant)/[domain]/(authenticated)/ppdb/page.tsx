import Link from "next/link";

import { endSessionAction } from "@/app/(tenant)/[domain]/(authenticated)/ppdb/actions";
import { SubmissionsTable } from "@/app/(tenant)/[domain]/(authenticated)/ppdb/submissions-table";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { createAcademicYearService } from "@/lib/academic-year";
import { academicYearStore } from "@/lib/academic-year-data";
import { createPpdbSessionService } from "@/lib/ppdb-session";
import { ppdbSessionStore } from "@/lib/ppdb-session-data";
import { createPpdbSubmissionService } from "@/lib/ppdb-submission";
import { ppdbSubmissionStore } from "@/lib/ppdb-submission-data";
import { enforceMasterDataAccess } from "@/lib/tenant-master-data-route-access";
import { ClipboardList, FileSearch, History, PencilLine, PlusCircle, Search, StopCircle } from "lucide-react";

const sessionService = createPpdbSessionService({ store: ppdbSessionStore });
const submissionService = createPpdbSubmissionService({ store: ppdbSubmissionStore });
const academicYearService = createAcademicYearService({ store: academicYearStore });

export default async function PPDBDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ domain: string }>;
  searchParams: Promise<{ q?: string; result?: string }>;
}) {
  const [{ domain }, raw] = await Promise.all([params, searchParams]);
  const principal = await enforceMasterDataAccess(domain, "read");
  const [sessions, years] = await Promise.all([sessionService.list(principal), academicYearService.list(principal)]);
  const current = sessions.find((session) => session.status === "published") ?? sessions.find((session) => session.status === "draft");
  const submissions = current ? await submissionService.list(principal, current.id) : [];
  const search = (raw.q ?? "").trim().toLocaleLowerCase("id-ID");
  const filtered = search
    ? submissions.filter((submission) => submission.studentName.toLocaleLowerCase("id-ID").includes(search) || submission.nisn.includes(search))
    : submissions;
  const yearLabel = current ? years.find((year) => year.id === current.academicYearId)?.label ?? current.academicYearId : null;

  return (
    <main className="min-h-svh bg-slate-50 text-slate-950 pb-20">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Review Pendaftaran PPDB</h1>
          <p className="text-sm text-slate-500">
            Domain: {domain}
            {current ? ` • Tahun Ajaran ${yearLabel} • Berakhir ${current.endDate}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          {!current ? (
            <Button nativeButton={false} render={<Link href={`/${domain}/ppdb/settings`} />} className="gap-1.5">
              <PlusCircle className="size-4" />
              Buat Sesi PPDB
            </Button>
          ) : current.status === "draft" ? (
            <Button nativeButton={false} render={<Link href={`/${domain}/ppdb/settings`} />} variant="outline" className="gap-1.5">
              <PencilLine className="size-4" />
              Lanjutkan Buat Form
            </Button>
          ) : principal.capabilities.write ? (
            <form action={endSessionAction.bind(null, domain)}>
              <input type="hidden" name="sessionId" value={current.id} />
              <Button type="submit" variant="destructive" className="gap-1.5">
                <StopCircle className="size-4" />
                Akhiri Sesi PPDB
              </Button>
            </form>
          ) : null}
          <Button nativeButton={false} render={<Link href={`/${domain}/ppdb/riwayat`} />} variant="outline" className="gap-1.5 border-amber-500 text-amber-700 hover:bg-amber-50 hover:text-amber-800">
            <History className="size-4" />
            Riwayat PPDB
          </Button>
        </div>
      </header>

      {raw.result ? (
        <p role="status" className="mx-6 mt-4 rounded-lg border border-slate-200 bg-white p-3 text-sm">
          {raw.result === "saved" ? "Perubahan Sesi PPDB tersimpan." : `Perubahan ditolak: ${raw.result}.`}
        </p>
      ) : null}

      <div className="p-6 h-[calc(100vh-80px)]">
        <div className="mx-auto h-full flex flex-col">
          {!current ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white">
              <ClipboardList className="size-10 text-slate-300" />
              <p className="text-sm text-slate-500">Belum ada Sesi PPDB. Buat Sesi PPDB untuk mulai menerima pendaftaran.</p>
            </div>
          ) : current.status === "draft" ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white">
              <FileSearch className="size-10 text-slate-300" />
              <p className="text-sm text-slate-500">Sesi PPDB ini belum dipublikasikan, jadi belum ada pendaftar yang bisa direview.</p>
            </div>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row gap-4 justify-between items-center mb-4">
                <form className="w-full sm:w-80" action={`/${domain}/ppdb`}>
                  <InputGroup>
                    <InputGroupAddon>
                      <Search className="size-4 text-slate-400" />
                    </InputGroupAddon>
                    <InputGroupInput type="text" name="q" defaultValue={raw.q ?? ""} placeholder="Cari nama atau NISN..." />
                  </InputGroup>
                </form>
              </div>
              <div className="flex-1 rounded-xl border border-slate-200 bg-white shadow-sm overflow-auto">
                <SubmissionsTable domain={domain} submissions={filtered} writable={principal.capabilities.write} redirectPath={`/${domain}/ppdb`} />
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
