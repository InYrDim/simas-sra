import Link from "next/link";

import { Button } from "@/components/ui/button";
import { createAcademicYearService } from "@/lib/academic-year";
import { academicYearStore } from "@/lib/academic-year-data";
import { createClassGroupService } from "@/lib/class-group";
import { classGroupStore } from "@/lib/class-group-data";
import { createQuizSessionService } from "@/lib/quiz";
import { quizSessionStore } from "@/lib/quiz-data";
import { createSubjectCatalogService } from "@/lib/subject-catalog";
import { subjectCatalogStore } from "@/lib/subject-catalog-data";
import { enforceMasterDataAccess } from "@/lib/tenant-master-data-route-access";
import { ClipboardList, Eye, History, Monitor, PenLine, Trophy } from "lucide-react";

const sessionService = createQuizSessionService({ store: quizSessionStore });
const academicYearService = createAcademicYearService({ store: academicYearStore });
const classGroupService = createClassGroupService({ store: classGroupStore });
const subjectService = createSubjectCatalogService({ store: subjectCatalogStore });

const statusLabel: Record<string, string> = {
  draft: "Draft",
  active: "Berlangsung",
  ended: "Selesai",
  graded: "Dinilai",
};

const statusColor: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600",
  active: "bg-green-100 text-green-700",
  ended: "bg-amber-100 text-amber-700",
  graded: "bg-blue-100 text-blue-700",
};

const modeLabel: Record<string, string> = {
  daring: "Daring",
  luring: "Luring",
};

export default async function RiwayatPage({
  params,
  searchParams,
}: {
  params: Promise<{ domain: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { domain } = await params;
  const principal = await enforceMasterDataAccess(domain, "read");
  const [sessions, years, groups, subjects] = await Promise.all([
    sessionService.list(principal),
    academicYearService.list(principal),
    classGroupService.list(principal),
    subjectService.list(principal),
  ]);

  // Filter to ended/graded sessions only (history)
  const historySessions = sessions
    .filter((s) => s.status === "ended" || s.status === "graded")
    .sort((a, b) => (b.endedAt?.getTime() ?? 0) - (a.endedAt?.getTime() ?? 0));

  function yearLabel(id: string) { return years.find((y) => y.id === id)?.label ?? id; }
  function groupLabel(id: string) { return groups.find((g) => g.id === id)?.groupName ?? id; }
  function subjectLabel(id: string) { return subjects.find((s) => s.id === id)?.name ?? id; }

  return (
    <main className="min-h-svh bg-slate-50 text-slate-950 pb-20">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-3">
        <History className="size-5 text-slate-400" />
        <div>
          <h1 className="text-xl font-bold">Riwayat Ulangan</h1>
          <p className="text-sm text-slate-500">Data historis ulangan yang sudah selesai atau dinilai</p>
        </div>
      </header>

      <div className="p-6">
        {historySessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white py-20">
            <ClipboardList className="size-10 text-slate-300" />
            <p className="text-sm text-slate-500">Belum ada riwayat ulangan.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Judul</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Mapel</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Rombel</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Mode</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Tahun Ajaran</th>
                  <th className="px-4 py-3 text-center font-medium text-slate-600">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Tanggal Selesai</th>
                  <th className="px-4 py-3 text-center font-medium text-slate-600">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {historySessions.map((session) => (
                  <tr key={session.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">{session.title}</td>
                    <td className="px-4 py-3 text-slate-600">{subjectLabel(session.subjectId)}</td>
                    <td className="px-4 py-3 text-slate-600">{groupLabel(session.classGroupId)}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-slate-600">
                        {session.mode === "daring" ? <Monitor className="size-3.5" /> : <PenLine className="size-3.5" />}
                        {modeLabel[session.mode]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{yearLabel(session.academicYearId)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor[session.status]}`}>
                        {statusLabel[session.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {session.endedAt?.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) ?? "-"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <Link href={`/${domain}/ulangan/riwayat/${session.id}`}>
                          <Button variant="ghost" size="sm" className="gap-1 text-xs">
                            <Eye className="size-3" />
                            Detail
                          </Button>
                        </Link>
                        {session.status === "graded" && (
                          <Link href={`/${domain}/ulangan/${session.id}/penilaian`}>
                            <Button variant="ghost" size="sm" className="gap-1 text-xs text-blue-600 hover:text-blue-700">
                              <Trophy className="size-3" />
                              Hasil
                            </Button>
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
