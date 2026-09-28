import ExcelJS from "exceljs";

import {
    SCHOOL_SCHEDULE_DAYS,
    isScheduleTime,
    type SchoolScheduleDayInput,
    type SchoolScheduleDayOfWeek,
} from "@/lib/attendance/attendance-schedule";

/**
 * Pure parser for the Gerbang schedule import workbook (exceljs).
 *
 * Sheet 1 "Jadwal" — one row per weekday, all 7 rows required:
 *   A: hari (monday..sunday, ID or EN label)  B: mulai "HH:MM"
 *   C: selesai "HH:MM"                        D: efektif (ya/tidak, 1/0)
 * Sheet 2 "Libur" (optional) — holiday ranges:
 *   A: nama  B: mulai "YYYY-MM-DD"  C: selesai "YYYY-MM-DD"
 *
 * Returns a typed result instead of throwing so the server action can surface
 * per-row errors without leaking stack traces.
 */

export type ScheduleImportRowError = { row: number; column: string; message: string };

export type ScheduleImportResult =
    | {
        ok: true;
        days: SchoolScheduleDayInput[];
        holidays: Array<{ name: string; startDate: string; endDate: string }>;
    }
    | { ok: false; errors: ScheduleImportRowError[] };

const DAY_LABELS: Record<string, SchoolScheduleDayOfWeek> = {
    monday: "monday", senin: "monday",
    tuesday: "tuesday", selasa: "tuesday",
    wednesday: "wednesday", rabu: "wednesday",
    thursday: "thursday", kamis: "thursday",
    friday: "friday", jumat: "friday", "jum'at": "friday",
    saturday: "saturday", sabtu: "saturday",
    sunday: "sunday", minggu: "sunday", ahad: "sunday",
};

const CIVIL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function normalizeText(value: ExcelJS.CellValue): string {
    const raw = value == null ? "" : value instanceof Date ? value.toISOString().slice(0, 10) : String(value);
    return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

function cellText(row: ExcelJS.Row, column: number): string {
    return normalizeText(row.getCell(column).value);
}

function pushError(errors: ScheduleImportRowError[], row: number, column: string, message: string): void {
    errors.push({ row, column, message });
}

function parseEffective(raw: string): boolean | null {
    if (["ya", "yes", "true", "1", "efektif"].includes(raw)) return true;
    if (["tidak", "no", "false", "0", "non-efektif", "libur"].includes(raw)) return false;
    return null;
}

function parseHolidayDate(raw: string): string | null {
    if (CIVIL_DATE_PATTERN.test(raw)) return raw;
    // Excel may deliver real dates via the Date branch of normalizeText already.
    return null;
}

export async function parseScheduleWorkbook(buffer: ArrayBuffer): Promise<ScheduleImportResult> {
    const workbook = new ExcelJS.Workbook();
    try {
        await workbook.xlsx.load(buffer);
    } catch {
        return { ok: false, errors: [{ row: 0, column: "file", message: "Berkas bukan workbook Excel yang valid." }] };
    }

    const sheet = workbook.worksheets.find((worksheet) => worksheet.name.trim().toLowerCase() === "jadwal")
        ?? workbook.worksheets[0];
    if (!sheet) {
        return { ok: false, errors: [{ row: 0, column: "file", message: "Sheet Jadwal tidak ditemukan." }] };
    }

    const errors: ScheduleImportRowError[] = [];
    const days: SchoolScheduleDayInput[] = [];
    const seen = new Set<SchoolScheduleDayOfWeek>();

    // Row 1 is the header; data starts at row 2. All 7 weekdays are required.
    for (const row of sheet.getRows(2, sheet.rowCount) ?? []) {
        const rowNumber = row.number;
        const dayLabel = cellText(row, 1);
        if (dayLabel === "") continue;
        const dayKey = dayLabel.replace(/'/g, "");
        const dayOfWeek = DAY_LABELS[dayKey] ?? DAY_LABELS[dayKey.split(" ")[0] ?? ""];
        if (!dayOfWeek) {
            pushError(errors, rowNumber, "hari", `Hari tidak dikenal: "${dayLabel}".`);
            continue;
        }
        if (seen.has(dayOfWeek)) {
            pushError(errors, rowNumber, "hari", `Hari ${dayOfWeek} muncul lebih dari sekali.`);
            continue;
        }
        seen.add(dayOfWeek);

        const startTime = cellText(row, 2);
        if (!isScheduleTime(startTime)) {
            pushError(errors, rowNumber, "mulai", "Jam mulai harus berformat HH:MM (contoh 07:00).");
            continue;
        }
        const endTime = cellText(row, 3);
        if (!isScheduleTime(endTime)) {
            pushError(errors, rowNumber, "selesai", "Jam selesai harus berformat HH:MM (contoh 13:00).");
            continue;
        }
        if (endTime <= startTime) {
            pushError(errors, rowNumber, "selesai", "Jam selesai harus setelah jam mulai.");
            continue;
        }
        const effective = parseEffective(cellText(row, 4));
        if (effective === null) {
            pushError(errors, rowNumber, "efektif", "Isi dengan ya/tidak.");
            continue;
        }
        days.push({ dayOfWeek, startTime, endTime, effective });
    }

    for (const day of SCHOOL_SCHEDULE_DAYS) {
        if (!seen.has(day)) pushError(errors, 0, "hari", `Baris untuk hari ${day} wajib ada.`);
    }

    // Optional holiday sheet.
    const holidaySheet = workbook.worksheets.find((worksheet) => worksheet.name.trim().toLowerCase() === "libur");
    const holidays: Array<{ name: string; startDate: string; endDate: string }> = [];
    if (holidaySheet) {
        for (const row of holidaySheet.getRows(2, holidaySheet.rowCount) ?? []) {
            const rowNumber = row.number;
            const name = cellText(row, 1);
            const startDate = cellText(row, 2);
            const endDate = cellText(row, 3);
            if (name === "" && startDate === "" && endDate === "") continue;
            const start = parseHolidayDate(startDate);
            const end = parseHolidayDate(endDate);
            if (!start || !end) {
                pushError(errors, rowNumber, "libur", "Tanggal libur harus berformat YYYY-MM-DD.");
                continue;
            }
            if (end < start) {
                pushError(errors, rowNumber, "libur", "Tanggal selesai libur tidak boleh sebelum tanggal mulai.");
                continue;
            }
            holidays.push({ name: name || "Libur", startDate: start, endDate: end });
        }
    }

    if (errors.length > 0) return { ok: false, errors };
    return { ok: true, days, holidays };
}
