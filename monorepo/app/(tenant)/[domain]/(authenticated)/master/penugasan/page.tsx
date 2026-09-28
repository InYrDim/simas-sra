import Link from "next/link";
import {
  CalendarPlus,
  CircleCheck,
  CircleOff,
  Flag,
  RefreshCcw,
  UserRoundCog,
} from "lucide-react";

import {
  loadPenugasanPageState,
  type PenugasanPageState,
} from "./data";
import { PenugasanDialog } from "./penugasan-dialog";
import { penugasanResult } from "./result-codes";
import {
  activateTeachingAssignmentAction,
  cancelTeachingAssignmentAction,
  createTeachingAssignmentAction,
  endTeachingAssignmentAction,
  replaceTeachingAssignmentAction,
  updatePlannedTeachingAssignmentAction,
} from "./actions";
import { ValidatedSubmitButton } from "@/components/master-data/validated-submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select as UISelect, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const statusLabels: Record<PenugasanPageState["assignments"][number]["status"], string> = {
  planned: "Direncanakan",
  active: "Aktif",
  ended: "Berakhir",
  cancelled: "Dibatalkan",
};

function Field({ name, label, type = "text", optional = false, value }: { name: string; label: string; type?: string; optional?: boolean; value?: string }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} required={!optional} name={name} type={type} defaultValue={value} />
    </div>
  );
}

function Select({ name, label, options, required = true, defaultValue }: { name: string; label: string; options: { value: string; label: string }[]; required?: boolean; defaultValue?: string }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={name}>{label}</Label>
      <UISelect name={name} required={required} defaultValue={defaultValue}>
        <SelectTrigger id={name}>
          <SelectValue placeholder="Pilih" />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </UISelect>
    </div>
  );
}

function Hidden({ name, value }: { name: string; value: string | number }) {
  return <input type="hidden" name={name} value={value} />;
}

function ReasonField() {
  return (
    <div className="space-y-1">
      <Label htmlFor="reason">Alasan</Label>
      <Textarea id="reason" name="reason" required rows={2} placeholder="Wajib diisi dan tercatat di riwayat" />
    </div>
  );
}

function ScopeFields({ state, defaults }: { state: PenugasanPageState; defaults?: Partial<Record<"teacherProfileId" | "subjectId" | "classGroupId" | "academicYearId", string>> }) {
  return (
    <>
      <Select name="academicYearId" label="Tahun Ajaran" options={state.academicYears} defaultValue={defaults?.academicYearId} />
      <Select name="teacherProfileId" label="Guru" options={state.teachers} defaultValue={defaults?.teacherProfileId} />
      <Select name="subjectId" label="Mata Pelajaran" options={state.subjects} defaultValue={defaults?.subjectId} />
      <Select name="classGroupId" label="Rombongan Belajar" options={state.classGroups} defaultValue={defaults?.classGroupId} />
    </>
  );
}

function backQuery(state: PenugasanPageState) {
  const params = new URLSearchParams();
  if (state.filters.status !== "all") params.set("status", state.filters.status);
  if (state.filters.academicYearId) params.set("academicYearId", state.filters.academicYearId);
  return params;
}

function PlannedActions({ domain, state, assignment }: { domain: string; state: PenugasanPageState; assignment: PenugasanPageState["assignments"][number] }) {
  return (
    <div className="flex flex-wrap gap-2">
      <PenugasanDialog label="Aktifkan" title="Aktifkan Penugasan Mengajar" description="Penugasan berlaku mulai tanggal efektif yang dipilih; tahun ajaran harus aktif." icon={<CircleCheck aria-hidden />}>
        <form action={activateTeachingAssignmentAction.bind(null, domain)} className="space-y-4">
          <Hidden name="assignmentId" value={assignment.id} />
          <Hidden name="expectedVersion" value={assignment.version} />
          <Field name="effectiveOn" label="Tanggal efektif" type="date" value={assignment.startsOn} />
          <ReasonField />
          <ValidatedSubmitButton>Aktifkan</ValidatedSubmitButton>
        </form>
      </PenugasanDialog>
      <PenugasanDialog label="Ubah Rencana" title="Ubah Penugasan Direncanakan" description="Perubahan hanya berlaku untuk penugasan berstatus direncanakan." icon={<RefreshCcw aria-hidden />}>
        <form action={updatePlannedTeachingAssignmentAction.bind(null, domain)} className="space-y-4">
          <Hidden name="assignmentId" value={assignment.id} />
          <Hidden name="expectedVersion" value={assignment.version} />
          <ScopeFields state={state} defaults={{
            academicYearId: assignment.academicYearId,
            teacherProfileId: assignment.teacherProfileId,
            subjectId: assignment.subjectId,
            classGroupId: assignment.classGroupId,
          }} />
          <Field name="startsOn" label="Mulai berlaku" type="date" value={assignment.startsOn} />
          <Field name="endsOn" label="Selesai berlaku (opsional)" type="date" optional value={assignment.endsOn ?? undefined} />
          <ReasonField />
          <ValidatedSubmitButton>Simpan perubahan</ValidatedSubmitButton>
        </form>
      </PenugasanDialog>
      <PenugasanDialog label="Batalkan" title="Batalkan Penugasan" description="Penugasan direncanakan dibatalkan dan tidak akan berlaku." icon={<CircleOff aria-hidden />}>
        <form action={cancelTeachingAssignmentAction.bind(null, domain)} className="space-y-4">
          <Hidden name="assignmentId" value={assignment.id} />
          <Hidden name="expectedVersion" value={assignment.version} />
          <ReasonField />
          <ValidatedSubmitButton>Batalkan</ValidatedSubmitButton>
        </form>
      </PenugasanDialog>
    </div>
  );
}

function ActiveActions({ domain, state, assignment }: { domain: string; state: PenugasanPageState; assignment: PenugasanPageState["assignments"][number] }) {
  return (
    <div className="flex flex-wrap gap-2">
      <PenugasanDialog label="Ganti Guru" title="Ganti Guru Pengampu" description="Penugasan aktif ditutup pada tanggal penggantian, lalu penugasan baru dibuat aktif untuk Guru pengganti." icon={<UserRoundCog aria-hidden />}>
        <form action={replaceTeachingAssignmentAction.bind(null, domain)} className="space-y-4">
          <Hidden name="assignmentId" value={assignment.id} />
          <Hidden name="expectedVersion" value={assignment.version} />
          <ScopeFields state={state} defaults={{
            academicYearId: assignment.academicYearId,
            subjectId: assignment.subjectId,
            classGroupId: assignment.classGroupId,
          }} />
          <Field name="startsOn" label="Tanggal penggantian" type="date" value={assignment.startsOn} />
          <ReasonField />
          <ValidatedSubmitButton>Simpan penggantian</ValidatedSubmitButton>
        </form>
      </PenugasanDialog>
      <PenugasanDialog label="Akhiri" title="Akhiri Penugasan Mengajar" description="Penugasan berlaku sampai tanggal berakhir yang dipilih, tanpa pengganti." icon={<Flag aria-hidden />}>
        <form action={endTeachingAssignmentAction.bind(null, domain)} className="space-y-4">
          <Hidden name="assignmentId" value={assignment.id} />
          <Hidden name="expectedVersion" value={assignment.version} />
          <Field name="effectiveOn" label="Tanggal berakhir" type="date" />
          <ReasonField />
          <ValidatedSubmitButton>Akhiri</ValidatedSubmitButton>
        </form>
      </PenugasanDialog>
    </div>
  );
}

export default async function PenugasanMengajarPage({
  params,
  searchParams,
}: {
  params: Promise<{ domain: string }>;
  searchParams: Promise<{ selected?: string; status?: string; academicYearId?: string; result?: string }>;
}) {
  const { domain } = await params;
  const query = await searchParams;
  const state = await loadPenugasanPageState(domain, {
    selected: query.selected,
    status: query.status,
    academicYearId: query.academicYearId,
  });
  const resultCode = penugasanResult(query.result);
  const selected = state.assignments.find((assignment) => assignment.id === state.selectedId) ?? null;
  const statusOptions = [
    { value: "all", label: "Semua status" },
    ...(Object.entries(statusLabels) as [string, string][]).map(([value, label]) => ({ value, label })),
  ];
  const yearOptions = [
    { value: "", label: "Semua tahun ajaran" },
    ...state.academicYears.map((year) => ({ value: year.value, label: year.label })),
  ];

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Penugasan Mengajar</h1>
          <p className="text-sm text-muted-foreground">
            Menetapkan Guru pengampu Mata Pelajaran per Rombongan Belajar per Tahun Ajaran.
            Dipakai Ulangan dan Jadwal Mengajar.
          </p>
        </div>
        <PenugasanDialog label="Tambah Penugasan" title="Tambah Penugasan Mengajar" description="Penugasan baru berstatus direncanakan; aktifkan setelah data lengkap." icon={<CalendarPlus aria-hidden />}>
          <form action={createTeachingAssignmentAction.bind(null, domain)} className="space-y-4">
            <ScopeFields state={state} />
            <Field name="startsOn" label="Mulai berlaku" type="date" />
            <Field name="endsOn" label="Selesai berlaku (opsional)" type="date" optional />
            <ReasonField />
            <ValidatedSubmitButton>Simpan</ValidatedSubmitButton>
          </form>
        </PenugasanDialog>
      </div>

      {resultCode ? (
        <div
          role="status"
          className={`rounded border p-3 text-sm ${resultCode.ok ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-destructive bg-destructive/10 text-destructive"}`}
        >
          {resultCode.message}
        </div>
      ) : null}

      <form method="get" className="flex flex-wrap items-end gap-3 rounded border p-3">
        <Select name="status" label="Status" required={false} defaultValue={state.filters.status} options={statusOptions} />
        <Select name="academicYearId" label="Tahun Ajaran" required={false} defaultValue={state.filters.academicYearId} options={yearOptions} />
        <Button type="submit" variant="outline">Terapkan filter</Button>
      </form>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <section className="rounded border">
          <header className="border-b p-3 text-sm font-semibold">Daftar Penugasan ({state.assignments.length})</header>
          {state.assignments.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              Belum ada penugasan. Tambahkan penugasan pertama lewat tombol Tambah Penugasan.
            </p>
          ) : (
            <ul className="divide-y">
              {state.assignments.map((assignment) => {
                const back = backQuery(state);
                return (
                  <li key={assignment.id} className="p-3">
                    <Link
                      href={`?selected=${assignment.id}${back.size ? `&${back.toString()}` : ""}`}
                      className="font-medium hover:underline"
                    >
                      {assignment.teacherName}
                    </Link>
                    <span className="text-sm text-muted-foreground">
                      {" "}· {assignment.subjectName} · {assignment.classGroupName} · {assignment.yearLabel} · {assignment.startsOn} s.d. {assignment.endsOn ?? "sekarang"} · {statusLabels[assignment.status]}
                    </span>
                    {state.selectedId === assignment.id ? (
                      <div className="mt-3">
                        {assignment.status === "planned" ? <PlannedActions domain={domain} state={state} assignment={assignment} /> : null}
                        {assignment.status === "active" ? <ActiveActions domain={domain} state={state} assignment={assignment} /> : null}
                        {assignment.status === "ended" || assignment.status === "cancelled" ? (
                          <span className="text-sm text-muted-foreground">
                            Tidak ada aksi untuk penugasan {statusLabels[assignment.status].toLowerCase()}.
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded border">
          <header className="border-b p-3 text-sm font-semibold">Riwayat Penugasan Terpilih</header>
          {selected ? (
            <div className="p-3">
              <p className="mb-2 text-sm text-muted-foreground">
                {selected.teacherName} · {selected.subjectName} · {selected.classGroupName}
              </p>
              {state.events.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada riwayat.</p>
              ) : (
                <ol className="space-y-2 text-sm">
                  {state.events.map((event) => (
                    <li key={event.id} className="rounded border p-2">
                      <span className="font-medium">{event.operation}</span>
                      <span className="text-muted-foreground">
                        {" "}· efektif {event.effectiveOn} · {new Date(event.occurredAt).toLocaleString("id-ID")}
                      </span>
                      <p className="text-muted-foreground">{event.reason}</p>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          ) : (
            <p className="p-6 text-sm text-muted-foreground">Pilih penugasan untuk melihat riwayatnya.</p>
          )}
        </section>
      </div>
    </div>
  );
}
