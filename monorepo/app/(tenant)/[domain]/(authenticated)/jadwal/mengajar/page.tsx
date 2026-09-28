import { CalendarPlus, Clock, ExternalLink, ListOrdered, Pencil, Trash2 } from "lucide-react";

import {
  createTeachingPeriodAction,
  createTeachingSlotAction,
  deleteTeachingPeriodAction,
  deleteTeachingSlotAction,
  updateTeachingSlotAction,
} from "../actions";
import { JadwalActionDialog, JadwalConfirmDialog } from "./jadwal-dialogs";
import {
  dayLabel,
  loadJadwalMengajarState,
  semesterLabel,
  type JadwalAssignmentOption,
  type JadwalPeriodItem,
  type JadwalSlotItem,
} from "./data";
import { SlotFormFields } from "./slot-form-fields";

const DAY_ORDER = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;

const RESULT_MESSAGES: Record<string, string> = {
  created: "Slot jadwal berhasil dibuat.",
  updated: "Slot jadwal berhasil diperbarui.",
  deleted: "Slot jadwal berhasil dihapus.",
  "period-created": "Preset periode berhasil ditambahkan.",
  "period-deleted": "Preset periode berhasil dihapus.",
  "invalid-input": "Data form tidak lengkap atau tidak valid.",
  "not-found": "Data tidak ditemukan — mungkin sudah diubah pengguna lain.",
  "assignment-not-active": "Penugasan Mengajar belum aktif (atau sudah berakhir) — aktifkan dulu di Master Data.",
  "semester-mismatch": "Flag semester slot tidak cocok dengan semester aktif Tahun Ajaran penugasan.",
  conflict: "Jadwal bentrok — ada pelajaran lain pada jam yang sama untuk Guru atau Rombel ini.",
  "slot-in-use": "Slot sudah memiliki sesi absensi sehingga tidak dapat dihapus.",
  "version-conflict": "Data berubah di lain tempat — muat ulang lalu coba lagi.",
};

const OK_RESULTS = new Set(["created", "updated", "deleted", "period-created", "period-deleted"]);

function noticeFor(result: string | undefined): { tone: "ok" | "error"; text: string } | null {
  if (!result) return null;
  const text = RESULT_MESSAGES[result];
  if (!text) return { tone: "error", text: "Terjadi kesalahan — coba lagi." };
  return { tone: OK_RESULTS.has(result) ? "ok" : "error", text };
}

function SlotCard({
  slot,
  domain,
  classGroupId,
  assignments,
  periods,
}: {
  slot: JadwalSlotItem;
  domain: string;
  classGroupId: string;
  assignments: JadwalAssignmentOption[];
  periods: JadwalPeriodItem[];
}) {
  return (
    <div className="rounded-md border bg-card p-3 text-card-foreground shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{slot.subjectName}</p>
          <p className="truncate text-xs text-muted-foreground">{slot.teacherName}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <JadwalActionDialog
            label=""
            title="Edit Slot Jadwal"
            description="Ubah jadwal pertemuan mingguan ini. Konflik Guru/Rombel tetap dicek saat menyimpan."
            icon={<Pencil className="size-3.5" aria-hidden />}              action={updateTeachingSlotAction.bind(null, domain)}
            hiddenFields={{ domain, slotId: slot.id, expectedVersion: String(slot.version), classGroupId }}
            submitLabel="Simpan perubahan"
            triggerVariant="ghost"
          >
            <SlotFormFields
              key={`${slot.id}:${slot.version}`}
              assignments={assignments}
              periods={periods}
              defaults={{ teachingAssignmentId: slot.teachingAssignmentId, dayOfWeek: slot.dayOfWeek, startTime: slot.startTime, endTime: slot.endTime, semester: slot.semester }}
            />
          </JadwalActionDialog>
          <JadwalConfirmDialog
            label="Hapus slot jadwal"
            title="Hapus Slot Jadwal?"
            description="Slot tanpa sesi absensi akan dihapus permanen. Slot yang sudah memiliki sesi tidak dapat dihapus."
            icon={<Trash2 className="size-3.5" aria-hidden />}              action={deleteTeachingSlotAction.bind(null, domain)}
            hiddenFields={{ domain, slotId: slot.id, classGroupId }}
          />
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <Clock className="size-3.5" aria-hidden />
        <span>
          {slot.startTime}–{slot.endTime}
        </span>
        <span aria-hidden>·</span>
        <span>{semesterLabel[slot.semester]}</span>
      </div>
    </div>
  );
}

export default async function JadwalMengajarPage({
  params,
  searchParams,
}: {
  params: Promise<{ domain: string }>;
  searchParams: Promise<{ result?: string; classGroupId?: string }>;
}) {
  const { domain } = await params;
  const query = await searchParams;
  const state = await loadJadwalMengajarState(domain, { classGroupId: query.classGroupId });
  const notice = noticeFor(query.result);
  const selected = state.classGroups.find((group) => group.id === state.selectedClassGroupId) ?? null;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Jadwal Mengajar</h1>
        <a
          className="inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
          href={`/${domain}/master/penugasan`}
        >
          <ExternalLink className="size-3.5" aria-hidden />
          Kelola Penugasan Mengajar di Master Data
        </a>
      </div>

      {notice ? (
        <div
          role="status"
          className={`rounded-md border p-3 text-sm ${
            notice.tone === "ok" ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-red-300 bg-red-50 text-red-900"
          }`}
        >
          {notice.text}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {state.classGroups.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada Rombongan Belajar — buat dulu di Master Data.</p>
        ) : (
          state.classGroups.map((group) => (
            <a
              key={group.id}
              href={`/${domain}/jadwal/mengajar?classGroupId=${group.id}`}
              className={`rounded-full border px-3 py-1 text-sm ${
                group.id === state.selectedClassGroupId ? "border-primary bg-primary text-primary-foreground" : "bg-card text-card-foreground hover:bg-accent"
              }`}
            >
              {group.label}
            </a>
          ))
        )}
      </div>

      {selected ? (
        <>
          {state.activeSemester ? (
            <p className="text-sm text-muted-foreground">Semester aktif: {semesterLabel[state.activeSemester]}</p>
          ) : null}

          {state.assignments.length === 0 ? (
            <div className="rounded-md border bg-card p-4 text-sm text-card-foreground shadow-sm">
              Belum ada Penugasan Mengajar aktif untuk {selected.label}.{" "}
              <a className="text-primary underline-offset-4 hover:underline" href={`/${domain}/master/penugasan`}>
                Buat dan aktifkan di Master Data
              </a>{" "}
              sebelum menyusun jadwal.
            </div>
          ) : (
            <JadwalActionDialog
              label="Tambah Slot"
              title="Tambah Slot Jadwal"
              description={`Pertemuan mingguan baru untuk ${selected.label}. Slot langsung berlaku setelah disimpan.`}
              icon={<CalendarPlus className="size-4" aria-hidden />}
              action={createTeachingSlotAction.bind(null, domain)}
              hiddenFields={{ domain, classGroupId: selected.id }}
              submitLabel="Simpan slot"
            >
              <SlotFormFields assignments={state.assignments} periods={state.periods} defaultSemester={state.activeSemester} />
            </JadwalActionDialog>
          )}

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {DAY_ORDER.filter((day) => day !== "sunday").map((day) => {
              const daySlots = state.slots.filter((slot) => slot.dayOfWeek === day);
              return (
                <section key={day} className="rounded-lg border bg-muted/30 p-3">
                  <h2 className="mb-2 text-sm font-semibold">{dayLabel[day]}</h2>
                  <div className="flex flex-col gap-2">
                    {daySlots.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Tidak ada jadwal.</p>
                    ) : (
                      daySlots.map((slot) => (
                        <SlotCard
                          key={slot.id}
                          slot={slot}
                          domain={domain}
                          classGroupId={selected.id}
                          assignments={state.assignments}
                          periods={state.periods}
                        />
                      ))
                    )}
                  </div>
                </section>
              );
            })}
          </div>

          <section className="rounded-lg border bg-card p-4 text-card-foreground shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="inline-flex items-center gap-2 text-sm font-semibold">
                <ListOrdered className="size-4" aria-hidden />
                Preset Periode Jam Pelajaran
              </h2>
              <JadwalActionDialog
                label="Tambah Periode"
                title="Tambah Preset Periode"
                description="Preset pengisi cepat jam form slot — slot tetap menyimpan jam eksplisit."
                icon={<CalendarPlus className="size-4" aria-hidden />}
                action={createTeachingPeriodAction.bind(null, domain)}
                hiddenFields={{ domain }}
                submitLabel="Simpan periode"
              >
                <label className="flex flex-col gap-1 text-sm">
                  <span>Label</span>
                  <input name="label" required maxLength={100} placeholder="Jam ke-1" className="rounded-md border bg-background px-3 py-2 text-sm" />
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <label className="flex flex-col gap-1 text-sm">
                    <span>Mulai</span>
                    <input type="time" name="startTime" required className="rounded-md border bg-background px-3 py-2 text-sm" />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span>Selesai</span>
                    <input type="time" name="endTime" required className="rounded-md border bg-background px-3 py-2 text-sm" />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span>Urutan</span>
                    <input type="number" name="sortOrder" required min={1} className="rounded-md border bg-background px-3 py-2 text-sm" />
                  </label>
                </div>
              </JadwalActionDialog>
            </div>
            {state.periods.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">Belum ada preset periode.</p>
            ) : (
              <ul className="mt-2 flex flex-wrap gap-2">
                {state.periods.map((period) => (
                  <li key={period.id} className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs">
                    <span>
                      {period.label} ({period.startTime}–{period.endTime})
                    </span>
                    <JadwalConfirmDialog
                      label={`Hapus periode ${period.label}`}
                      title="Hapus Preset Periode?"
                      description="Preset hanya alat bantu form — menghapusnya tidak mengubah slot yang sudah ada."
                      icon={<Trash2 className="size-3.5" aria-hidden />}
                      action={deleteTeachingPeriodAction.bind(null, domain)}
                      hiddenFields={{ domain, periodId: period.id }}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : state.classGroups.length > 0 ? (
        <div className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
          <p className="text-muted-foreground">Pilih Rombongan Belajar untuk melihat dan menyusun jadwalnya.</p>
        </div>
      ) : null}
    </div>
  );
}
