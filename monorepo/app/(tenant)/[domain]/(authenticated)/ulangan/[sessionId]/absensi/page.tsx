import Link from "next/link";

import { markAttendanceAction } from "@/app/(tenant)/[domain]/(authenticated)/ulangan/actions";
import { Button } from "@/components/ui/button";
import { createClassGroupService } from "@/lib/class-group";
import { classGroupStore } from "@/lib/class-group-data";
import { createQuizSessionService } from "@/lib/quiz";
import { quizSessionStore } from "@/lib/quiz-data";
import { createStudentMasterDataService } from "@/lib/student-master-data";
import { studentMasterDataStore } from "@/lib/student-master-data-data";
import { enforceMasterDataAccess } from "@/lib/tenant-master-data-route-access";
import { ArrowLeft, CheckCircle, UserX, Clock } from "lucide-react";

const sessionService = createQuizSessionService({ store: quizSessionStore });
const classGroupService = createClassGroupService({ store: classGroupStore });
const studentService = createStudentMasterDataService({ store: studentMasterDataStore });

const statusLabel: Record<string, string> = {
  present: "Hadir",
  absent: "Tidak Hadir",
  late: "Terlambat",
};

const statusIcon: Record<string, typeof CheckCircle> = {
  present: CheckCircle,
  absent: UserX,
  late: Clock,
};

export default async function AbsensiPage({
  params,
  searchParams,
}: {
  params: Promise<{ domain: string; sessionId: string }>;
  searchParams: Promise<{ result?: string }>;
}) {
  const [{ domain, sessionId }, raw] = await Promise.all([params, searchParams]);
  const principal = await enforceMasterDataAccess(domain, "read");

  const [sessions, groups] = await Promise.all([
    sessionService.list(principal),
    classGroupService.list(principal),
  ]);

  const session = sessions.find((s) => s.id === sessionId);
  if (!session) {
    return (
      <main className="min-h-svh bg-slate-50 text-slate-950 flex items-center justify-center">
        <p className="text-slate-500">Sesi ulangan tidak ditemukan.</p>
      </main>
    );
  }

  // Get students in the class group
  const allStudents = await studentService.list(principal);
  const classStudents = allStudents.filter(
    (s) => s.classGroupName && s.student.archived === false
  );

  // Get attendance records
  const attendanceSummary = await sessionService.getAttendanceSummary(principal, sessionId);
  const attendanceMap = new Map(
    attendanceSummary.records.map((a) => [a.studentId, a])
  );

  const groupName = groups.find((g) => g.id === session.classGroupId)?.groupName ?? session.classGroupId;

  return (
    <main className="min-h-svh bg-slate-50 text-slate-950 pb-20">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center gap-3">
          <Link href={`/${domain}/ulangan/${sessionId}`} className="text-slate-500 hover:text-slate-700">
            <ArrowLeft className="size-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold">Absensi: {session.title}</h1>
            <p className="text-sm text-slate-500">{groupName} • {session.mode === "daring" ? "Daring" : "Luring"}</p>
          </div>
        </div>
      </header>

      {raw.result ? (
        <p role="status" className="mx-6 mt-4 rounded-lg border border-slate-200 bg-white p-3 text-sm">
          {raw.result === "saved" ? "Absensi tersimpan." : `Operasi ditolak: ${raw.result}.`}
        </p>
      ) : null}

      <div className="p-6">
        {/* Ringkasan */}
        <div className="grid gap-4 sm:grid-cols-4 mb-6">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Total Siswa</p>
            <p className="text-2xl font-bold">{classStudents.length}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Hadir</p>
            <p className="text-2xl font-bold text-green-600">{attendanceSummary.present}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Terlambat</p>
            <p className="text-2xl font-bold text-amber-600">{attendanceSummary.late}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">Tidak Hadir</p>
            <p className="text-2xl font-bold text-red-600">{attendanceSummary.absent}</p>
          </div>
        </div>

        {/* Tabel Absensi */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 text-left font-medium text-slate-600">#</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600">Nama Siswa</th>
                <th className="px-4 py-3 text-center font-medium text-slate-600">Status</th>
                <th className="px-4 py-3 text-center font-medium text-slate-600">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {classStudents.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                    Tidak ada siswa di rombel ini.
                  </td>
                </tr>
              ) : (
                classStudents.map((record, idx) => {
                  const attendance = attendanceMap.get(record.student.id);
                  const currentStatus = attendance?.status ?? null;

                  return (
                    <tr key={record.student.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-500">{idx + 1}</td>
                      <td className="px-4 py-3 font-medium">{record.person.fullName}</td>
                      <td className="px-4 py-3 text-center">
                        {currentStatus ? (
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            currentStatus === "present" ? "bg-green-100 text-green-700" :
                            currentStatus === "late" ? "bg-amber-100 text-amber-700" :
                            "bg-red-100 text-red-700"
                          }`}>
                            {(() => { const Icon = statusIcon[currentStatus]; return <Icon className="size-3" />; })()}
                            {statusLabel[currentStatus]}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">Belum ditandai</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <form action={markAttendanceAction.bind(null, domain)}>
                            <input type="hidden" name="sessionId" value={sessionId} />
                            <input type="hidden" name="studentId" value={record.student.id} />
                            <input type="hidden" name="status" value="present" />
                            <Button
                              type="submit"
                              variant={currentStatus === "present" ? "default" : "outline"}
                              size="sm"
                              className="gap-1 text-xs"
                            >
                              <CheckCircle className="size-3" />
                              Hadir
                            </Button>
                          </form>
                          <form action={markAttendanceAction.bind(null, domain)}>
                            <input type="hidden" name="sessionId" value={sessionId} />
                            <input type="hidden" name="studentId" value={record.student.id} />
                            <input type="hidden" name="status" value="late" />
                            <Button
                              type="submit"
                              variant={currentStatus === "late" ? "default" : "outline"}
                              size="sm"
                              className="gap-1 text-xs"
                            >
                              <Clock className="size-3" />
                              Terlambat
                            </Button>
                          </form>
                          <form action={markAttendanceAction.bind(null, domain)}>
                            <input type="hidden" name="sessionId" value={sessionId} />
                            <input type="hidden" name="studentId" value={record.student.id} />
                            <input type="hidden" name="status" value="absent" />
                            <Button
                              type="submit"
                              variant={currentStatus === "absent" ? "destructive" : "outline"}
                              size="sm"
                              className="gap-1 text-xs"
                            >
                              <UserX className="size-3" />
                              Absen
                            </Button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
