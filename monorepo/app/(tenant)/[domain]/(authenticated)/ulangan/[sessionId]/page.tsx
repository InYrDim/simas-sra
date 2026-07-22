import Link from "next/link";

import { AddQuestionForm } from "@/app/(tenant)/[domain]/(authenticated)/ulangan/[sessionId]/add-question-form";
import { ActiveSessionControls } from "@/app/(tenant)/[domain]/(authenticated)/ulangan/[sessionId]/attendance-dialog";
import { activateSessionAction, removeQuestionAction } from "@/app/(tenant)/[domain]/(authenticated)/ulangan/actions";
import { Button } from "@/components/ui/button";
import { createAcademicYearService } from "@/lib/academic-year";
import { academicYearStore } from "@/lib/academic-year-data";
import { createClassGroupService } from "@/lib/class-group";
import { classGroupStore } from "@/lib/class-group-data";
import { createQuizSessionService } from "@/lib/quiz";
import { quizSessionStore } from "@/lib/quiz-data";
import { createStudentMasterDataService } from "@/lib/student-master-data";
import { studentMasterDataStore } from "@/lib/student-master-data-data";
import { createSubjectCatalogService } from "@/lib/subject-catalog";
import { subjectCatalogStore } from "@/lib/subject-catalog-data";
import { enforceMasterDataAccess } from "@/lib/tenant-master-data-route-access";
import { ArrowLeft, CheckCircle, FileText, PlayCircle, PlusCircle, Trash2 } from "lucide-react";

const sessionService = createQuizSessionService({ store: quizSessionStore });
const academicYearService = createAcademicYearService({ store: academicYearStore });
const classGroupService = createClassGroupService({ store: classGroupStore });
const subjectService = createSubjectCatalogService({ store: subjectCatalogStore });
const studentService = createStudentMasterDataService({ store: studentMasterDataStore });

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

const typeLabel: Record<string, string> = {
  multiple_choice: "Pilihan Ganda",
  true_false: "Benar/Salah",
  essay: "Essay",
};

export default async function QuizSessionDetailPage({
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

  const [questions, allStudents, attendanceSummary] = await Promise.all([
    sessionService.listQuestions(principal, sessionId),
    writable && session.status === "active" ? studentService.list(principal) : Promise.resolve([]),
    writable && session.status === "active"
      ? sessionService.getAttendanceSummary(principal, sessionId)
      : Promise.resolve({ records: [], present: 0, late: 0, absent: 0 }),
  ]);
  const sortedQuestions = [...questions].sort((a, b) => a.orderIndex - b.orderIndex);
  const totalPoints = sortedQuestions.reduce((sum, q) => sum + q.points, 0);

  const yearLabel = years.find((y) => y.id === session.academicYearId)?.label ?? session.academicYearId;
  const groupName = groups.find((g) => g.id === session.classGroupId)?.groupName ?? session.classGroupId;
  const subjectName = subjects.find((s) => s.id === session.subjectId)?.name ?? session.subjectId;
  const attendanceMap = new Map(attendanceSummary.records.map((record) => [record.studentId, record.status]));
  const attendanceStudents = allStudents
    .filter((record) => record.classGroupName && record.student.archived === false)
    .map((record) => ({
      id: record.student.id,
      name: record.person.fullName,
      status: attendanceMap.get(record.student.id) ?? null,
    }));

  return (
    <main className="min-h-svh bg-slate-50 text-slate-950 pb-20">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center gap-3 mb-2">
          <Link href={`/${domain}/ulangan`} className="text-slate-500 hover:text-slate-700">
            <ArrowLeft className="size-5" />
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold">{session.title}</h1>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor[session.status]}`}>
                {statusLabel[session.status]}
              </span>
            </div>
            <p className="text-sm text-slate-500">
              {modeLabel[session.mode]} • {subjectName} • {groupName} • {yearLabel}
              {session.durationMinutes ? ` • ${session.durationMinutes} menit` : ""}
            </p>
          </div>
          <div className="flex gap-2">
            {writable && session.status === "draft" && questions.length > 0 && (
              <form action={activateSessionAction.bind(null, domain)}>
                <input type="hidden" name="sessionId" value={session.id} />
                <Button type="submit" className="gap-1.5 bg-green-600 hover:bg-green-700">
                  <PlayCircle className="size-4" />
                  Mulai Ulangan
                </Button>
              </form>
            )}
            {writable && session.status === "active" && (
              <ActiveSessionControls
                domain={domain}
                sessionId={session.id}
                sessionTitle={session.title}
                groupName={groupName}
                mode={session.mode}
                students={attendanceStudents}
              />
            )}
            {session.status === "ended" && (
              <Link href={`/${domain}/ulangan/${session.id}/penilaian`}>
                <Button className="gap-1.5">
                  <CheckCircle className="size-4" />
                  Penilaian
                </Button>
              </Link>
            )}
          </div>
        </div>

        {session.description && (
          <p className="text-sm text-slate-600 mt-1">{session.description}</p>
        )}
      </header>

      {raw.result ? (
        <p role="status" className="mx-6 mt-4 rounded-lg border border-slate-200 bg-white p-3 text-sm">
          {raw.result === "saved" ? "Perubahan tersimpan." : `Operasi ditolak: ${raw.result}.`}
        </p>
      ) : null}

      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            Daftar Soal ({sortedQuestions.length} soal, {totalPoints} poin)
          </h2>
        </div>

        {sortedQuestions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white py-16">
            <FileText className="size-10 text-slate-300" />
            <p className="text-sm text-slate-500">Belum ada soal. Tambahkan soal di bawah ini.</p>
          </div>
        ) : (
          <div className="space-y-3 mb-6">
            {sortedQuestions.map((q, idx) => (
              <div key={q.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-slate-400">Soal {idx + 1}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{typeLabel[q.questionType]}</span>
                      <span className="text-xs text-slate-400">{q.points} poin</span>
                    </div>
                    <p className="text-sm text-slate-800 whitespace-pre-wrap">{q.questionText}</p>
                    {q.options && q.options.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {q.options.map((opt, i) => (
                          <p key={i} className="text-sm text-slate-600">
                            {String.fromCharCode(65 + i)}. {opt}
                            {q.correctAnswer === opt && (
                              <span className="ml-2 text-green-600 font-medium">(Jawaban Benar)</span>
                            )}
                          </p>
                        ))}
                      </div>
                    )}
                    {q.questionType === "essay" && q.correctAnswer && (
                      <p className="mt-2 text-sm text-green-600">Kunci Jawaban: {q.correctAnswer}</p>
                    )}
                  </div>
                  {writable && session.status === "draft" && (
                    <form action={removeQuestionAction.bind(null, domain)}>
                      <input type="hidden" name="sessionId" value={session.id} />
                      <input type="hidden" name="questionId" value={q.id} />
                      <Button type="submit" variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50">
                        <Trash2 className="size-4" />
                      </Button>
                    </form>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {writable && session.status === "draft" && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <PlusCircle className="size-4" />
              Tambah Soal
            </h3>
            <AddQuestionForm domain={domain} sessionId={session.id} />
          </div>
        )}
      </div>
    </main>
  );
}
