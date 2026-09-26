"use server";

import { revalidatePath } from "next/cache";

import { enforceTenantOperation } from "@/lib/features/tenant-feature-route-access";
import { tenantAuthorizationStore } from "@/lib/authorization/tenant-authorization-data";
import { SCHOOL_SCHEDULE_DAYS, isScheduleTime, type SchoolScheduleDayOfWeek } from "@/lib/attendance/attendance-schedule";
import {
    listSchoolHolidays,
    listSchoolScheduleDays,
    saveSchoolHolidays,
    saveSchoolScheduleDay,
} from "@/lib/attendance/attendance-schedule-data";
import { parseScheduleWorkbook } from "@/lib/attendance/attendance-schedule-import";

export type SaveScheduleResult = {
    ok: boolean;
    code?: "invalid-input" | "not-found" | "error";
};

/**
 * Persists the Gerbang schedule: one row per weekday plus the holiday list.
 * Requires the same authority as other absensi settings (`absensi.settings.save`).
 */
export async function saveGerbangScheduleAction(
    domain: string,
    formData: FormData,
): Promise<SaveScheduleResult> {
    await enforceTenantOperation(domain, "absensi.settings.save");

    const tenant = await tenantAuthorizationStore.loadTenantByDomain(domain);
    if (!tenant) return { ok: false, code: "not-found" };

    const days: Array<{ dayOfWeek: SchoolScheduleDayOfWeek; startTime: string; endTime: string; effective: boolean }> = [];
    for (const day of SCHOOL_SCHEDULE_DAYS) {
        const enabled = formData.get(`day-enabled:${day}`) === "on";
        const startTime = String(formData.get(`day-start:${day}`) ?? "").trim();
        const endTime = String(formData.get(`day-end:${day}`) ?? "").trim();
        if (!enabled) continue;
        if (!isScheduleTime(startTime) || !isScheduleTime(endTime) || endTime <= startTime) {
            return { ok: false, code: "invalid-input" };
        }
        days.push({ dayOfWeek: day, startTime, endTime, effective: true });
    }

    const holidays: Array<{ name: string; startDate: string; endDate: string }> = [];
    const rawHolidays = String(formData.get("holidays") ?? "");
    for (const line of rawHolidays.split("\n")) {
        const trimmed = line.trim();
        if (trimmed === "") continue;
        const parts = trimmed.split(/[;|]/).map((part) => part.trim());
        if (parts.length < 3 || !/^\d{4}-\d{2}-\d{2}$/.test(parts[1] ?? "") || !/^\d{4}-\d{2}-\d{2}$/.test(parts[2] ?? "") || (parts[2] ?? "") < (parts[1] ?? "")) {
            return { ok: false, code: "invalid-input" };
        }
        holidays.push({ name: parts[0] ?? "Libur", startDate: parts[1] ?? "", endDate: parts[2] ?? "" });
    }

    try {
        for (const day of SCHOOL_SCHEDULE_DAYS) {
            const configured = days.find((candidate) => candidate.dayOfWeek === day);
            await saveSchoolScheduleDay(
                tenant.id,
                configured ?? { dayOfWeek: day, startTime: "07:00", endTime: "13:00", effective: false },
            );
        }
        await saveSchoolHolidays(tenant.id, holidays);
    } catch {
        return { ok: false, code: "error" };
    }

    revalidatePath(`/${domain}/absensi/gerbang`);
    revalidatePath(`/${domain}/absensi/settings/schedule`);
    return { ok: true };
}

export type ImportScheduleResult = {
    ok: boolean;
    code?: "invalid-input" | "not-found" | "error";
    errors?: Array<{ row: number; column: string; message: string }>;
    imported?: { days: number; holidays: number };
};

/**
 * Imports the Gerbang schedule from an uploaded Excel workbook. Validation is
 * pure (`parseScheduleWorkbook`); rows are only written when the whole
 * workbook validates.
 */
export async function importGerbangScheduleAction(
    domain: string,
    formData: FormData,
): Promise<ImportScheduleResult> {
    await enforceTenantOperation(domain, "absensi.settings.save");

    const tenant = await tenantAuthorizationStore.loadTenantByDomain(domain);
    if (!tenant) return { ok: false, code: "not-found" };

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return { ok: false, code: "invalid-input" };
    if (file.size > 2 * 1024 * 1024) return { ok: false, code: "invalid-input" };

    let parsed;
    try {
        parsed = await parseScheduleWorkbook(await file.arrayBuffer());
    } catch {
        return { ok: false, code: "error" };
    }
    if (!parsed.ok) return { ok: false, code: "invalid-input", errors: parsed.errors };

    try {
        for (const day of parsed.days) {
            await saveSchoolScheduleDay(tenant.id, day);
        }
        await saveSchoolHolidays(tenant.id, parsed.holidays);
    } catch {
        return { ok: false, code: "error" };
    }

    revalidatePath(`/${domain}/absensi/gerbang`);
    revalidatePath(`/${domain}/absensi/settings/schedule`);
    return { ok: true, imported: { days: parsed.days.length, holidays: parsed.holidays.length } };
}

/** Loads the current schedule for the settings form (server-side read). */
export async function loadGerbangScheduleAction(
    domain: string,
): Promise<{
    ok: boolean;
    days: Array<{ dayOfWeek: SchoolScheduleDayOfWeek; startTime: string; endTime: string; effective: boolean }>;
    holidays: Array<{ name: string; startDate: string; endDate: string }>;
}> {
    await enforceTenantOperation(domain, "absensi.settings.save");
    const tenant = await tenantAuthorizationStore.loadTenantByDomain(domain);
    if (!tenant) return { ok: false, days: [], holidays: [] };
    const [days, holidays] = await Promise.all([
        listSchoolScheduleDays(tenant.id),
        listSchoolHolidays(tenant.id),
    ]);
    return { ok: true, days, holidays };
}
