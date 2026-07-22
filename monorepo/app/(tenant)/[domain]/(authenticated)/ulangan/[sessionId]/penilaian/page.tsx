import Link from "next/link";

import { gradeSessionAction } from "@/app/(tenant)/[domain]/(authenticated)/ulangan/actions";
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
import { ArrowLeft, CheckCircle, FileText } from "lucide-react";

const sessionService = createQuizSessionService({ store: quizSessionStore });
const academicYearService = createAcademicYearService({ store: academicYearStore });
const classGroupService = createClassGroupService({ store: classGroupStore });
const subjectService = createSubjectCatalogService({ store: subjectCatalogStore });


const statusLabel: Record<string, string> = {
  in_progress: "Mengerjakan",
  submitted: "Selesai Dikerjakan",
  graded: "Dinilai",
};

const statusColor: Record<string, string> = {
  in_progress: "bg-slate-100 text-slate-600",
  submitted: "bg-amber-100 text-amber-700",
  graded: "bg-green-100 text-green-700",
};

export default async function PenilaianPage({
  params,
  searchParams,
}: {
  params: Promise<{ domain: string; sessionId: string }>;
  searchParams: Promise<{ result?: string }>;
}) {
  const [{ domain, sessionId }, raw] = await Promise.all([params, searchParams]);
  const principal = await enforceMasterDataAccess(domain, "read");
  const writable = principal.capabilities.write;

  const [sessions, years, groups, subjects] = await Promise.all([
    sessionService.list(principal),
    academicYearService.list(principal),
    classGroupService.list(principal),
    subjectService.list(principal),
  ]);

  const session = sessions.find((s) => s.id === sessionId);
  if (!session) {
    return (
      <main className="min-h-svh bg-slate-50 text-slate-950 flex items-center justify-center">
        <p className="text-slate-500">Sesi ulangan tidak ditemukan.</p>
      </main>
    );
  }

  const [sheets, questions] = await Promise.all([
    sessionService.listAnswerSheets(principal, sessionId),
    sessionService.listQuestions(principal, sessionId),
  ]);

  const sorted = [...sheets].sort((a, b) => {
    if (a.totalScore !== null && b.totalScore !== null) return b.totalScore - a.totalScore;
    if (a.totalScore !== null) return -1;
    if (b.totalScore !== null) return 1;
    return 0;
  });

  const yearLabel = years.find((y) => y.id === session.academicYearId)?.label ?? session.academicYearId;
  const groupName = groups.find((g) => g.id === session.classGroupId)?.groupName ?? session.classGroupId;
  const subjectName = subjects.find((s) => s.id === session.subjectId)?.name ?? session.subjectId;

  const totalMaxScore = questions.reduce((sum, q) => sum + q.points, 0);
  const gradedSheets = sorted.filter((s) => s.status === "graded");
  const avgScore = gradedSheets.length > 0
    ? gradedSheets.reduce((sum, s) => sum + ((s.totalScore ?? 0) / (s.maxScore ?? 1)) * 100, 0) / gradedSheets.length
    : 0;

  return (
    <main className="min-h-svh bg-slate-50 text-slate-950 pb-20">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center gap-3 mb-2">
          <Link href={`/${domain}/ulangan/${sessionId}`} className="text-slate-500 hover:text-slate-700">
            <ArrowLeft className="size-5" />
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Penilaian: {session.title}</h1>
            <p className="text-sm text-slate-500">
              {subjectName} • {groupName} • {yearLabel}
            </p>
          </div>
          {writable && session.status === "ended" && (
            <form action={gradeSessionAction.bind(null, domain)}>
              <input type="hidden" name="sessionId" value={session.id} />
              <Button type="submit" className="gap-1.5 bg-blue-600 hover:bg-blue-700">
                <CheckCircle className="size-4" />
                Proses Penilaian Otomatis
              </Button>
            </form>
          )}
        </div>
      </header>

      {raw.result ? (
        <p role="status" className="mx-6 mt-4 rounded-lg border border-slate-200 bg-white p-3 text-sm">
          {raw.result === "saved" ? "Penilaian berhasil diproses." : `Operasi ditolak: ${raw.result}.`}
        </p>
      ) : null}

      <div className="p-6">
        {/* Ringkasan */}
        <div className="grid gap-4 sm:grid-cols-4 mb-6">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Total Peserta</p>
            <p className="text-2xl font-bold">{sorted.length}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Sudah Dinilai</p>
            <p className="text-2xl font-bold text-green-600">{gradedSheets.length}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Maksimum Poin</p>
            <p className="text-2xl font-bold">{totalMaxScore}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Rata-rata Nilai</p>
            <p className="text-2xl font-bold">{avgScore.toFixed(1)}%</p>
          </div>
        </div>

        {/* Tabel Hasil */}
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white py-16">
            <FileText className="size-10 text-slate-300" />
            <p className="text-sm text-slate-500">Belum ada peserta yang mengerjakan ulangan ini.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 text-left font-medium text-slate-600">#</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Siswa</th>
                  <th className="px-4 py-3 text-center font-medium text-slate-600">Status</th>
                  <th className="px-4 py-3 text-center font-medium text-slate-600">Skor</th>
                  <th className="px-4 py-3 text-center font-medium text-slate-600">Nilai</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((sheet, idx) => {
                  const scorePercent = sheet.totalScore !== null && sheet.maxScore !== null && sheet.maxScore > 0
                    ? Math.round((sheet.totalScore / sheet.maxScore) * 100)
                    : null;
                  return (
                    <tr key={sheet.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-500">{idx + 1}</td>
                      <td className="px-4 py-3 font-medium">{sheet.studentId}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor[sheet.status]}`}>
                          {statusLabel[sheet.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {sheet.totalScore !== null && sheet.maxScore !== null
                          ? `${sheet.totalScore} / ${sheet.maxScore}`
                          : "-"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {scorePercent !== null ? (
                          <span className={`font-semibold ${scorePercent >= 70 ? "text-green-600" : scorePercent >= 50 ? "text-amber-600" : "text-red-600"}`}>
                            {scorePercent}%
                          </span>
                        ) : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
