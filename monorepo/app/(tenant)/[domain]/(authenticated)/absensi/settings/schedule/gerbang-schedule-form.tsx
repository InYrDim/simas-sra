"use client";

import { useActionState, useState } from "react";

import {
    importGerbangScheduleAction,
    saveGerbangScheduleAction,
    type ImportScheduleResult,
    type SaveScheduleResult,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { CalendarClock, Upload } from "lucide-react";

const DAYS: Array<{ key: string; label: string }> = [
    { key: "monday", label: "Senin" },
    { key: "tuesday", label: "Selasa" },
    { key: "wednesday", label: "Rabu" },
    { key: "thursday", label: "Kamis" },
    { key: "friday", label: "Jumat" },
    { key: "saturday", label: "Sabtu" },
    { key: "sunday", label: "Minggu" },
];

export type ScheduleDayView = {
    dayOfWeek: string;
    startTime: string;
    endTime: string;
    effective: boolean;
};

export function GerbangScheduleForm({
    domain,
    days,
    holidays,
}: {
    domain: string;
    days: ScheduleDayView[];
    holidays: Array<{ name: string; startDate: string; endDate: string }>;
}) {
    const [saveState, saveAction, savePending] = useActionState<SaveScheduleResult, FormData>(
        (_, formData) => saveGerbangScheduleAction(domain, formData),
        { ok: true },
    );
    const [importState, importAction, importPending] = useActionState<ImportScheduleResult, FormData>(
        (_, formData) => importGerbangScheduleAction(domain, formData),
        { ok: true },
    );
    const [importDialogOpen, setImportDialogOpen] = useState(false);

    const dayByKey = new Map(days.map((day) => [day.dayOfWeek, day]));

    return (
        <div className="flex flex-col gap-6">
            <form action={saveAction} className="rounded-lg border bg-card text-card-foreground shadow-sm p-6 space-y-4">
                <div className="flex items-center gap-2">
                    <CalendarClock className="size-5" aria-hidden />
                    <h2 className="text-lg font-semibold">Jadwal Sekolah (Gerbang)</h2>
                </div>
                <p className="text-sm text-muted-foreground">
                    Sesi Gerbang dibuka otomatis pada jam masuk dan ditutup pada jam pulang untuk hari yang efektif.
                    Hari non-efektif dan tanggal libur tidak membuat sesi.
                </p>

                <div className="space-y-2">
                    {DAYS.map(({ key, label }) => {
                        const day = dayByKey.get(key);
                        const effective = day?.effective ?? false;
                        return (
                            <div key={key} className="flex flex-wrap items-center gap-3 text-sm">
                                <label className="flex w-56 items-center gap-2">
                                    <input
                                        type="checkbox"
                                        name={`day-enabled:${key}`}
                                        defaultChecked={effective}
                                        className="size-4"
                                    />
                                    <span className="font-medium">{label}</span>
                                </label>
                                <label className="flex items-center gap-1">
                                    <span className="text-muted-foreground">Masuk</span>
                                    <input
                                        type="time"
                                        name={`day-start:${key}`}
                                        defaultValue={day?.startTime ?? "07:00"}
                                        className="rounded-md border bg-input/30 px-2 py-1 text-sm"
                                    />
                                </label>
                                <label className="flex items-center gap-1">
                                    <span className="text-muted-foreground">Pulang</span>
                                    <input
                                        type="time"
                                        name={`day-end:${key}`}
                                        defaultValue={day?.endTime ?? "13:00"}
                                        className="rounded-md border bg-input/30 px-2 py-1 text-sm"
                                    />
                                </label>
                            </div>
                        );
                    })}
                </div>

                <div className="space-y-2">
                    <label className="flex flex-col gap-1 text-sm">
                        <span className="font-medium">Tanggal Libur</span>
                        <span className="text-xs text-muted-foreground">
                            Satu per baris, format: Nama;YYYY-MM-DD;YYYY-MM-DD (inklusif). Contoh:
                            Libur Semester;2026-12-21;2027-01-03
                        </span>
                        <textarea
                            name="holidays"
                            rows={4}
                            className="rounded-md border bg-input/30 px-3 py-2 font-mono text-sm"
                            defaultValue={holidays
                                .map((holiday) => `${holiday.name};${holiday.startDate};${holiday.endDate}`)
                                .join("\n")}
                            placeholder={"Libur Semester;2026-12-21;2027-01-03\nIdul Fitri;2027-03-10;2027-03-14"}
                        />
                    </label>
                </div>

                {!saveState.ok && (
                    <p className="text-sm text-destructive" role="alert">
                        {saveState.code === "invalid-input"
                            ? "Ada isian tidak valid: periksa format jam (HH:MM) dan tanggal libur."
                            : "Gagal menyimpan jadwal. Coba lagi."}
                    </p>
                )}
                {saveState.ok && savePending === false ? null : null}

                <Button type="submit" disabled={savePending}>
                    {savePending ? <Spinner /> : null}
                    Simpan Jadwal
                </Button>
            </form>

            <form
                action={importAction}
                onSubmit={() => setImportDialogOpen(true)}
                className="rounded-lg border bg-card text-card-foreground shadow-sm p-6 space-y-3"
            >
                <div className="flex items-center gap-2">
                    <Upload className="size-5" aria-hidden />
                    <h2 className="text-lg font-semibold">Impor Jadwal dari Excel</h2>
                </div>
                <p className="text-sm text-muted-foreground">
                    Sheet <strong>Jadwal</strong>: kolom hari, mulai, selesai, efektif (semua 7 hari wajib).
                    Sheet <strong>Libur</strong> (opsional): nama, mulai, selesai.
                </p>
                <input
                    type="file"
                    name="file"
                    accept=".xlsx"
                    required
                    className="block w-full rounded-md border bg-input/30 px-3 py-2 text-sm"
                />
                {!importState.ok && (
                    <div className="text-sm text-destructive" role="alert">
                        <p>Gagal mengimpor: periksa format berkas.</p>
                        {importState.errors && importState.errors.length > 0 ? (
                            <ul className="mt-1 list-disc pl-5">
                                {importState.errors.slice(0, 8).map((error, index) => (
                                    <li key={index}>
                                        {error.row > 0 ? `Baris ${error.row}` : "Sheet"}
                                        {" · "}
                                        {error.column}: {error.message}
                                    </li>
                                ))}
                            </ul>
                        ) : null}
                    </div>
                )}
                <Button type="submit" variant="secondary" disabled={importPending}>
                    {importPending ? <Spinner /> : <Upload aria-hidden />}
                    Unggah & Impor
                </Button>
                {importDialogOpen && importPending ? (
                    <p className="text-sm text-muted-foreground" role="status">Mengimpor jadwal…</p>
                ) : null}
            </form>
        </div>
    );
}
