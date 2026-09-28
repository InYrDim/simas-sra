"use client";

import { useState } from "react";

import type { JadwalAssignmentOption, JadwalPeriodItem } from "./data";
import type { SlotFormDefaults } from "./slot-form-types";

const DAY_ORDER = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;

// Client-local labels: ./data imports the DB module graph, so only its types
// may cross into client code.
const DAY_LABELS: Record<(typeof DAY_ORDER)[number], string> = {
  monday: "Senin",
  tuesday: "Selasa",
  wednesday: "Rabu",
  thursday: "Kamis",
  friday: "Jumat",
  saturday: "Sabtu",
  sunday: "Minggu",
};

const SEMESTER_LABELS = { odd: "Ganjil", even: "Genap" } as const;

/**
 * Form fields for creating/editing a Teaching Slot. The period preset select
 * is a pure form-filler (wayfinder 03): picking a period just copies its
 * "HH:MM" window into the time inputs — the slot stores explicit times and
 * holds no dependency on the period table.
 */
export function SlotFormFields({
  assignments,
  periods,
  defaults,
  defaultSemester,
}: {
  assignments: JadwalAssignmentOption[];
  periods: JadwalPeriodItem[];
  defaults?: Partial<SlotFormDefaults>;
  defaultSemester?: string | null;
}) {
  const [startTime, setStartTime] = useState(defaults?.startTime ?? "");
  const [endTime, setEndTime] = useState(defaults?.endTime ?? "");

  return (
    <>
      <label className="flex flex-col gap-1 text-sm">
        <span>Penugasan Mengajar (aktif)</span>
        <select name="teachingAssignmentId" required defaultValue={defaults?.teachingAssignmentId ?? ""} className="rounded-md border bg-background px-3 py-2 text-sm">
          <option value="">Pilih penugasan…</option>
          {assignments.map((assignment) => (
            <option key={assignment.id} value={assignment.id}>
              {assignment.label}
            </option>
          ))}
        </select>
      </label>
      {assignments.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Belum ada penugasan aktif untuk rombel ini — buat dan aktifkan lewat menu Master Data terlebih dahulu.
        </p>
      ) : null}
      <label className="flex flex-col gap-1 text-sm">
        <span>Hari</span>
        <select name="dayOfWeek" required defaultValue={defaults?.dayOfWeek ?? ""} className="rounded-md border bg-background px-3 py-2 text-sm">
          <option value="">Pilih hari…</option>
          {DAY_ORDER.map((day) => (
            <option key={day} value={day}>
              {DAY_LABELS[day]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span>Isi cepat dari periode jam pelajaran</span>
        <select
          value=""
          onChange={(event) => {
            const period = periods.find((candidate) => candidate.id === event.target.value);
            if (period) {
              setStartTime(period.startTime);
              setEndTime(period.endTime);
            }
          }}
          className="rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="">Pilih periode…</option>
          {periods.map((period) => (
            <option key={period.id} value={period.id}>
              {period.label} ({period.startTime}–{period.endTime})
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-sm">
          <span>Jam mulai</span>
          <input
            type="time"
            name="startTime"
            required
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
            className="rounded-md border bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>Jam selesai</span>
          <input
            type="time"
            name="endTime"
            required
            value={endTime}
            onChange={(event) => setEndTime(event.target.value)}
            className="rounded-md border bg-background px-3 py-2 text-sm"
          />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm">
        <span>Semester</span>
        <select
          name="semester"
          required
          defaultValue={defaults?.semester ?? defaultSemester ?? ""}
          className="rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="">Pilih semester…</option>
          <option value="odd">{SEMESTER_LABELS.odd}</option>
          <option value="even">{SEMESTER_LABELS.even}</option>
        </select>
      </label>
    </>
  );
}
