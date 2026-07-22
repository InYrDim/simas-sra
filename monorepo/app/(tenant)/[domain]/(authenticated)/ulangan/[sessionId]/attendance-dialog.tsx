"use client";

import { startTransition, useActionState, useEffect, useMemo, useState } from "react";
import { CheckCircle, Clock, Loader2, StopCircle, UserCheck, UserX } from "lucide-react";

import {
  endSessionAction,
  saveAttendanceBatchAction,
  type EndSessionActionState,
  type SaveAttendanceActionState,
} from "@/app/(tenant)/[domain]/(authenticated)/ulangan/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type AttendanceStatus = "present" | "absent" | "late";
type AttendanceStudent = { id: string; name: string; status: AttendanceStatus | null };
type AttendanceDraft = Record<string, AttendanceStatus>;

const saveInitialState: SaveAttendanceActionState = { status: "idle" };
const endInitialState: EndSessionActionState = { status: "idle" };
const validStatuses = new Set<AttendanceStatus>(["present", "absent", "late"]);

const statusLabel: Record<AttendanceStatus, string> = {
  present: "Hadir",
  absent: "Tidak Hadir",
  late: "Terlambat",
};

const statusIcon = {
  present: CheckCircle,
  absent: UserX,
  late: Clock,
};

export function ActiveSessionControls({
  domain,
  sessionId,
  sessionTitle,
  groupName,
  mode,
  students,
}: {
  domain: string;
  sessionId: string;
  sessionTitle: string;
  groupName: string;
  mode: "daring" | "luring";
  students: AttendanceStudent[];
}) {
  const storageKey = `quiz-attendance-draft:${domain}:${sessionId}`;
  const [attendanceOpen, setAttendanceOpen] = useState(false);
  const [warningOpen, setWarningOpen] = useState(false);
  const [draft, setDraft] = useState<AttendanceDraft>({});
  const [saveState, saveAction, savePending] = useActionState(saveAttendanceBatchAction.bind(null, domain), saveInitialState);
  const [endState, runEndAction, endPending] = useActionState(endSessionAction.bind(null, domain), endInitialState);

  const studentIds = useMemo(() => students.map((student) => student.id), [students]);
  const missingStudents = students.filter((student) => student.status === null);
  const displayedStudents = students.map((student) => ({ ...student, status: draft[student.id] ?? student.status }));
  const present = displayedStudents.filter((student) => student.status === "present").length;
  const late = displayedStudents.filter((student) => student.status === "late").length;
  const absent = displayedStudents.filter((student) => student.status === "absent").length;

  useEffect(() => {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "{}");
      if (!stored || typeof stored !== "object" || Array.isArray(stored)) return;
      const allowedIds = new Set(studentIds);
      const restored = Object.fromEntries(
        Object.entries(stored).filter(
          (entry): entry is [string, AttendanceStatus] => allowedIds.has(entry[0]) && validStatuses.has(entry[1] as AttendanceStatus),
        ),
      );
      queueMicrotask(() => setDraft(restored));
    } catch {
      localStorage.removeItem(storageKey);
    }
  }, [storageKey, studentIds]);

  useEffect(() => {
    if (saveState.status !== "saved") return;
    localStorage.removeItem(storageKey);
    queueMicrotask(() => {
      setDraft({});
      setAttendanceOpen(false);
    });
  }, [saveState.status, storageKey]);

  useEffect(() => {
    if (endState.status === "incomplete") queueMicrotask(() => setWarningOpen(true));
  }, [endState]);

  function setAttendance(studentId: string, status: AttendanceStatus) {
    setDraft((current) => {
      const next = { ...current, [studentId]: status };
      localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  }

  function submitEnd(fillMissingAbsent: boolean) {
    const formData = new FormData();
    formData.set("sessionId", sessionId);
    formData.set("studentIds", JSON.stringify(studentIds));
    formData.set("fillMissingAbsent", String(fillMissingAbsent));
    startTransition(() => runEndAction(formData));
  }

  function requestEnd() {
    if (missingStudents.length > 0) {
      setWarningOpen(true);
      return;
    }
    submitEnd(false);
  }

  const draftEntries = Object.entries(draft);

  return (
    <>
      <Dialog open={attendanceOpen} onOpenChange={setAttendanceOpen}>
        <DialogTrigger render={<Button type="button" variant="outline" className="gap-1.5" />}>
          <UserCheck className="size-4" />
          Absensi
        </DialogTrigger>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Absensi: {sessionTitle}</DialogTitle>
            <DialogDescription>
              {groupName} • {mode === "daring" ? "Daring" : "Luring"}. Perubahan disimpan sebagai draft di perangkat ini sampai tombol Simpan ditekan.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-4">
            <AttendanceSummary label="Total Siswa" value={students.length} />
            <AttendanceSummary label="Hadir" value={present} valueClassName="text-green-600" />
            <AttendanceSummary label="Terlambat" value={late} valueClassName="text-amber-600" />
            <AttendanceSummary label="Tidak Hadir" value={absent} valueClassName="text-red-600" />
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
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
                {displayedStudents.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500">Tidak ada siswa di rombel ini.</td></tr>
                ) : displayedStudents.map((student, index) => (
                  <tr key={student.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-500">{index + 1}</td>
                    <td className="px-4 py-3 font-medium">{student.name}</td>
                    <td className="px-4 py-3 text-center">
                      {student.status ? <AttendanceBadge status={student.status} draft={student.id in draft} /> : <span className="text-xs text-slate-400">Belum ditandai</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        {(["present", "late", "absent"] as const).map((status) => (
                          <AttendanceChoice key={status} status={status} selected={student.status === status} onClick={() => setAttendance(student.id, status)} />
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {saveState.status === "error" ? <p role="alert" className="text-sm text-red-600">Absensi gagal disimpan: {saveState.code}.</p> : null}
          <DialogFooter>
            <form action={saveAction}>
              <input type="hidden" name="sessionId" value={sessionId} />
              <input type="hidden" name="studentIds" value={JSON.stringify(draftEntries.map(([studentId]) => studentId))} />
              <input type="hidden" name="statuses" value={JSON.stringify(draftEntries.map(([, status]) => status))} />
              <Button type="submit" disabled={savePending || draftEntries.length === 0}>
                {savePending ? <Loader2 className="animate-spin" /> : null}
                {savePending ? "Menyimpan..." : "Simpan"}
              </Button>
            </form>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Button type="button" variant="destructive" className="gap-1.5" disabled={endPending} onClick={requestEnd}>
        {endPending ? <Loader2 className="size-4 animate-spin" /> : <StopCircle className="size-4" />}
        {endPending ? "Mengakhiri..." : "Akhiri Sesi"}
      </Button>

      <Dialog open={warningOpen} onOpenChange={setWarningOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Absensi belum lengkap</DialogTitle>
            <DialogDescription>
              Terdapat {endState.status === "incomplete" ? endState.missingStudentIds.length : missingStudents.length} siswa yang belum diisi absensinya. Lengkapi absensi atau tandai seluruhnya sebagai Tanpa Keterangan/Alpa sebelum mengakhiri sesi.
            </DialogDescription>
          </DialogHeader>
          {endState.status === "error" ? <p role="alert" className="text-sm text-red-600">Sesi gagal diakhiri: {endState.code}.</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setWarningOpen(false); setAttendanceOpen(true); }}>
              Lihat
            </Button>
            <Button type="button" variant="destructive" disabled={endPending} onClick={() => submitEnd(true)}>
              {endPending ? <Loader2 className="animate-spin" /> : null}
              Tandai Tanpa Keterangan/Alpa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AttendanceSummary({ label, value, valueClassName }: { label: string; value: number; valueClassName?: string }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-sm text-slate-500">{label}</p><p className={`text-2xl font-bold ${valueClassName ?? ""}`}>{value}</p></div>;
}

function AttendanceBadge({ status, draft }: { status: AttendanceStatus; draft: boolean }) {
  const Icon = statusIcon[status];
  const color = status === "present" ? "bg-green-100 text-green-700" : status === "late" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700";
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}><Icon className="size-3" />{statusLabel[status]}{draft ? " (Draft)" : ""}</span>;
}

function AttendanceChoice({ status, selected, onClick }: { status: AttendanceStatus; selected: boolean; onClick: () => void }) {
  const Icon = statusIcon[status];
  const label = status === "absent" ? "Absen" : statusLabel[status];
  return <Button type="button" variant={selected ? (status === "absent" ? "destructive" : "default") : "outline"} size="sm" className="gap-1 text-xs" onClick={onClick}><Icon className="size-3" />{label}</Button>;
}
