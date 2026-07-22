import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle, Clock, FileQuestion, Trophy, UserCheck, UserX } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createAcademicYearService } from "@/lib/academic-year";
import { academicYearStore } from "@/lib/academic-year-data";
import { createClassGroupService } from "@/lib/class-group";
import { classGroupStore } from "@/lib/class-group-data";
import { createQuizSessionService, type QuizAttendanceStatus } from "@/lib/quiz";
import { quizSessionStore } from "@/lib/quiz-data";
import { createStudentMasterDataService } from "@/lib/student-master-data";
import { studentMasterDataStore } from "@/lib/student-master-data-data";
import { createSubjectCatalogService } from "@/lib/subject-catalog";
import { subjectCatalogStore } from "@/lib/subject-catalog-data";
import { enforceMasterDataAccess } from "@/lib/tenant-master-data-route-access";

const sessionService = createQuizSessionService({ store: quizSessionStore });
const academicYearService = createAcademicYearService({ store: academicYearStore });
const classGroupService = createClassGroupService({ store: classGroupStore });
const subjectService = createSubjectCatalogService({ store: subjectCatalogStore });
const studentService = createStudentMasterDataService({ store: studentMasterDataStore });

const attendanceLabel: Record<QuizAttendanceStatus, string> = {
  present: "Hadir",
  late: "Terlambat",
  absent: "Tanpa Keterangan/Alpa",
};

const questionTypeLabel = {
  multiple_choice: "Pilihan Ganda",
  true_false: "Benar/Salah",
  essay: "Essay",
};

export default async function QuizHistoryDetailPage({
  params,
}: {
  params: Promise<{ domain: string; sessionId: string }>;
}) {
  const { domain, sessionId } = await params;
  const principal = await enforceMasterDataAccess(domain, "read");
  const [sessions, years, groups, subjects, students] = await Promise.all([
    sessionService.list(principal),
    academicYearService.list(principal),
    classGroupService.list(principal),
    subjectService.list(principal),
    studentService.list(principal),
  ]);
  const session = sessions.find((record) => record.id === sessionId);
  if (!session || (session.status !== "ended" && session.status !== "graded")) notFound();

  const [questions, attendance, answerSheets] = await Promise.all([
    sessionService.listQuestions(principal, sessionId),
    sessionService.listAttendance(principal, sessionId),
    sessionService.listAnswerSheets(principal, sessionId),
  ]);
  const studentNames = new Map(students.map((record) => [record.student.id, record.person.fullName]));
  const sortedQuestions = [...questions].sort((a, b) => a.orderIndex - b.orderIndex);
  const sortedAttendance = [...attendance].sort((a, b) => (studentNames.get(a.studentId) ?? a.studentId).localeCompare(studentNames.get(b.studentId) ?? b.studentId));
  const sortedSheets = [...answerSheets].sort((a, b) => (b.totalScore ?? -1) - (a.totalScore ?? -1));
  const totalPoints = sortedQuestions.reduce((total, question) => total + question.points, 0);
  const gradedSheets = sortedSheets.filter((sheet) => sheet.status === "graded");
  const averageScore = gradedSheets.length
    ? gradedSheets.reduce((total, sheet) => total + scorePercent(sheet.totalScore, sheet.maxScore), 0) / gradedSheets.length
    : 0;

  const yearLabel = years.find((year) => year.id === session.academicYearId)?.label ?? session.academicYearId;
  const groupLabel = groups.find((group) => group.id === session.classGroupId)?.groupName ?? session.classGroupId;
  const subjectLabel = subjects.find((subject) => subject.id === session.subjectId)?.name ?? session.subjectId;

  return (
    <main className="min-h-svh bg-slate-50 pb-20 text-slate-950">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <Link href={`/${domain}/ulangan/riwayat`} className="text-slate-500 hover:text-slate-700" aria-label="Kembali ke riwayat ulangan">
            <ArrowLeft className="size-5" />
          </Link>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold">{session.title}</h1>
              <Badge variant="secondary">{session.status === "graded" ? "Dinilai" : "Selesai"}</Badge>
            </div>
            <p className="text-sm text-slate-500">{subjectLabel} • {groupLabel} • {yearLabel} • {session.mode === "daring" ? "Daring" : "Luring"}</p>
          </div>
        </div>
      </header>

      <div className="space-y-6 p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <SummaryCard label="Peserta Tercatat" value={attendance.length} />
          <SummaryCard label="Jumlah Soal" value={sortedQuestions.length} />
          <SummaryCard label="Total Poin" value={totalPoints} />
        </div>

        <Tabs defaultValue="attendance">
          <TabsList className="w-full justify-start sm:w-fit">
            <TabsTrigger value="attendance"><UserCheck /> Absensi ({attendance.length})</TabsTrigger>
            <TabsTrigger value="questions"><FileQuestion /> Soal ({sortedQuestions.length})</TabsTrigger>
            <TabsTrigger value="scores"><Trophy /> Penilaian ({answerSheets.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="attendance" className="pt-4">
            <AttendanceDetail records={sortedAttendance} studentNames={studentNames} />
          </TabsContent>
          <TabsContent value="questions" className="space-y-3 pt-4">
            <QuestionDetail questions={sortedQuestions} />
          </TabsContent>
          <TabsContent value="scores" className="space-y-4 pt-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <SummaryCard label="Peserta Mengerjakan" value={answerSheets.length} />
              <SummaryCard label="Sudah Dinilai" value={gradedSheets.length} />
              <SummaryCard label="Rata-rata Nilai" value={`${averageScore.toFixed(1)}%`} />
            </div>
            <ScoreDetail sheets={sortedSheets} studentNames={studentNames} />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: number | string }) {
  return <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-500">{label}</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{value}</p></CardContent></Card>;
}

function AttendanceDetail({ records, studentNames }: { records: Awaited<ReturnType<typeof sessionService.listAttendance>>; studentNames: Map<string, string> }) {
  if (!records.length) return <EmptyState message="Tidak ada data absensi untuk sesi ini." />;
  return <div className="overflow-hidden rounded-xl border bg-white"><table className="w-full text-sm"><thead><tr className="border-b bg-slate-50"><th className="px-4 py-3 text-left">#</th><th className="px-4 py-3 text-left">Nama Siswa</th><th className="px-4 py-3 text-left">Status</th><th className="px-4 py-3 text-left">Keterangan</th></tr></thead><tbody>{records.map((record, index) => { const Icon = record.status === "present" ? CheckCircle : record.status === "late" ? Clock : UserX; return <tr key={record.id} className="border-b last:border-0"><td className="px-4 py-3 text-slate-500">{index + 1}</td><td className="px-4 py-3 font-medium">{studentNames.get(record.studentId) ?? record.studentId}</td><td className="px-4 py-3"><span className="inline-flex items-center gap-1.5"><Icon className="size-4" />{attendanceLabel[record.status]}</span></td><td className="px-4 py-3 text-slate-500">{record.notes ?? "-"}</td></tr>; })}</tbody></table></div>;
}

function QuestionDetail({ questions }: { questions: Awaited<ReturnType<typeof sessionService.listQuestions>> }) {
  if (!questions.length) return <EmptyState message="Tidak ada soal tersimpan untuk sesi ini." />;
  return questions.map((question, index) => <Card key={question.id}><CardHeader><div className="flex items-center justify-between gap-3"><CardTitle className="text-base">Soal {index + 1}</CardTitle><div className="flex gap-2"><Badge variant="secondary">{questionTypeLabel[question.questionType]}</Badge><Badge variant="outline">{question.points} poin</Badge></div></div></CardHeader><CardContent className="space-y-3"><p className="whitespace-pre-wrap">{question.questionText}</p>{question.options?.length ? <ol className="space-y-1 text-slate-600">{question.options.map((option, optionIndex) => <li key={`${question.id}-${optionIndex}`}>{String.fromCharCode(65 + optionIndex)}. {option}</li>)}</ol> : null}<p className="text-sm text-green-700"><span className="font-medium">Kunci jawaban:</span> {question.correctAnswer || "Tidak ditentukan"}</p></CardContent></Card>);
}

function ScoreDetail({ sheets, studentNames }: { sheets: Awaited<ReturnType<typeof sessionService.listAnswerSheets>>; studentNames: Map<string, string> }) {
  if (!sheets.length) return <EmptyState message="Tidak ada peserta yang mengerjakan ulangan ini." />;
  return <div className="overflow-hidden rounded-xl border bg-white"><table className="w-full text-sm"><thead><tr className="border-b bg-slate-50"><th className="px-4 py-3 text-left">#</th><th className="px-4 py-3 text-left">Nama Siswa</th><th className="px-4 py-3 text-center">Status</th><th className="px-4 py-3 text-center">Skor</th><th className="px-4 py-3 text-center">Nilai</th></tr></thead><tbody>{sheets.map((sheet, index) => { const percent = sheet.totalScore !== null && sheet.maxScore !== null ? scorePercent(sheet.totalScore, sheet.maxScore) : null; return <tr key={sheet.id} className="border-b last:border-0"><td className="px-4 py-3 text-slate-500">{index + 1}</td><td className="px-4 py-3 font-medium">{studentNames.get(sheet.studentId) ?? sheet.studentId}</td><td className="px-4 py-3 text-center">{sheet.status === "graded" ? "Dinilai" : sheet.status === "submitted" ? "Dikumpulkan" : "Mengerjakan"}</td><td className="px-4 py-3 text-center">{sheet.totalScore !== null && sheet.maxScore !== null ? `${sheet.totalScore} / ${sheet.maxScore}` : "-"}</td><td className="px-4 py-3 text-center font-semibold">{percent === null ? "-" : `${percent}%`}</td></tr>; })}</tbody></table></div>;
}

function EmptyState({ message }: { message: string }) {
  return <div className="rounded-xl border border-dashed bg-white py-12 text-center text-sm text-slate-500">{message}</div>;
}

function scorePercent(totalScore: number | null, maxScore: number | null) {
  return totalScore !== null && maxScore !== null && maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
}
