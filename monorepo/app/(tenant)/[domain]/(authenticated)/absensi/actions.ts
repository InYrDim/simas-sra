"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { enforceTenantOperation } from "@/lib/features/tenant-feature-route-access";
import { tenantAuthorizationStore } from "@/lib/authorization/tenant-authorization-data";
import { saveAbsensiConfig } from "@/lib/attendance/attendance-config-data";
import { recordAttendance, openSession, closeSession, deleteSession, deleteAttendanceRecord } from "@/lib/attendance/attendance-record-data";
import { getSessionWindow, readAbsensiSettings, readTenantTimezone } from "@/lib/attendance/attendance-config";
import {
    ATTENDANCE_LAYERS,
    isAttendanceLayer,
    isAttendanceMode,
    isSessionWindow,
    type AttendanceLayer,
    type AttendanceMode,
} from "@/lib/attendance/attendance-config";
import { isAttendanceRecordStatus } from "@/lib/attendance/attendance-record";

export type SaveAbsensiConfigResult = {
    ok: boolean;
    code?: "invalid-input" | "not-found" | "error";
};

/**
 * Persists the School Admin's layer→mode selection. The Provider-allowed set is
 * re-resolved server-side inside `saveAbsensiConfig`, so any mode/layer the
 * Provider disabled is clamped/pruned regardless of what the client submitted.
 */
export async function saveAbsensiConfigAction(
    domain: string,
    formData: FormData,
): Promise<SaveAbsensiConfigResult> {
    await enforceTenantOperation(domain, "absensi.settings.save");

    const requested: Partial<Record<AttendanceLayer, AttendanceMode | null>> = {};
    for (const layer of ATTENDANCE_LAYERS) {
        const enabled = formData.get(`layer-enabled:${layer}`);
        const raw = formData.get(`layer:${layer}`);
        const value = raw === null ? "" : String(raw);

        if (enabled !== "on") {
            // Layer toggled off (or not present): drop any binding for this layer.
            requested[layer] = null;
            continue;
        }
        if (value === "") {
            requested[layer] = null;
            continue;
        }
        if (!isAttendanceMode(value)) {
            return { ok: false, code: "invalid-input" };
        }
        requested[layer] = value;
    }

    // Unknown layer keys in the form are ignored; only the known layers are honored.
    for (const key of formData.keys()) {
        if (key.startsWith("layer:") || key.startsWith("layer-enabled:")) {
            const layer = key.slice(key.startsWith("layer-enabled:") ? "layer-enabled:".length : "layer:".length);
            if (!isAttendanceLayer(layer)) return { ok: false, code: "invalid-input" };
        }
    }

    const tenant = await tenantAuthorizationStore.loadTenantByDomain(domain);
    if (!tenant) return { ok: false, code: "not-found" };

    const result = await saveAbsensiConfig(tenant.id, requested);
    if (!result) return { ok: false, code: "not-found" };

    revalidatePath(`/${domain}/absensi`);
    revalidatePath(`/${domain}/absensi/settings`);
    redirect(`/${domain}/absensi/settings?result=saved`);
}

export type RecordGerbangResult = {
    ok: boolean;
    code?: "invalid-input" | "student-not-found" | "invalid-status" | "not-found" | "error";
};

/**
 * Records a Gerbang (gate) attendance event in Manual mode. The operator (the
 * logged-in user) selects the student and the direction (masuk/keluar). The
 * write path is shared with QR/Kartu via `recordAttendance`; only the identity
 * resolution and actor differ in Fase 3.
 */
export async function recordGerbangAction(
    domain: string,
    formData: FormData,
): Promise<RecordGerbangResult> {
    const principal = await enforceTenantOperation(domain, "absensi.gerbang.record");

    const studentId = String(formData.get("studentId") ?? "").trim();
    const status = String(formData.get("status") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim() || undefined;

    if (studentId === "" || !isAttendanceRecordStatus(status) || (status !== "masuk" && status !== "keluar" && status !== "izin" && status !== "sakit")) {
        return { ok: false, code: "invalid-input" };
    }

    const tenant = await tenantAuthorizationStore.loadTenantByDomain(domain);
    if (!tenant) return { ok: false, code: "not-found" };

    const result = await recordAttendance({
        tenantId: tenant.id,
        studentId,
        layer: "gerbang",
        mode: "manual",
        status,
        actorUserId: principal.userId,
        timezone: readTenantTimezone(tenant.settings),
        notes,
    });

    if (!result.ok) {
        return { ok: false, code: result.code === "student-not-found" ? "student-not-found" : result.code === "invalid-status" ? "invalid-status" : "error" };
    }

    revalidatePath(`/${domain}/absensi/gerbang`);
    return { ok: true };
}

export type OpenGerbangSessionResult = {
    ok: boolean;
    code?: "already-open" | "invalid-window" | "not-found" | "error";
};

/**
 * Opens a Gerbang attendance session for today. The planned window defaults to
 * the tenant's configured `sessionWindow.gerbang`, falling back to the default
 * Gerbang window when unset or invalid.
 */
export async function openGerbangSessionAction(
    domain: string,
    formData?: FormData,
): Promise<OpenGerbangSessionResult> {
    const principal = await enforceTenantOperation(domain, "absensi.gerbang.manage");

    const tenant = await tenantAuthorizationStore.loadTenantByDomain(domain);
    if (!tenant) return { ok: false, code: "not-found" };

    const settings = readAbsensiSettings(tenant.settings);
    const fallback = getSessionWindow(settings, "gerbang");

    // Allow the operator to override the planned window for today's session.
    const rawStart = formData ? String(formData.get("plannedStart") ?? "").trim() : "";
    const rawEnd = formData ? String(formData.get("plannedEnd") ?? "").trim() : "";
    const window = isSessionWindow({ start: rawStart, end: rawEnd }) ? { start: rawStart, end: rawEnd } : fallback;

    const result = await openSession({
        tenantId: tenant.id,
        layer: "gerbang",
        openedByUserId: principal.userId,
        plannedStart: window.start,
        plannedEnd: window.end,
        timezone: readTenantTimezone(tenant.settings),
        notes: formData ? String(formData.get("notes") ?? "").trim() || undefined : undefined,
    });

    if (!result.ok) return { ok: false, code: result.code };
    revalidatePath(`/${domain}/absensi/gerbang`);
    return { ok: true };
}

export type CloseGerbangSessionResult = {
    ok: boolean;
    code?: "not-found" | "error";
};

/** Closes an open Gerbang session. */
export async function closeGerbangSessionAction(
    domain: string,
    sessionId: string,
): Promise<CloseGerbangSessionResult> {
    await enforceTenantOperation(domain, "absensi.gerbang.manage");

    const tenant = await tenantAuthorizationStore.loadTenantByDomain(domain);
    if (!tenant) return { ok: false, code: "not-found" };

    const result = await closeSession(tenant.id, sessionId);
    if (!result.ok) return { ok: false, code: result.code };

    revalidatePath(`/${domain}/absensi/gerbang`);
    return { ok: true };
}

export type DeleteGerbangSessionResult = {
    ok: boolean;
    code?: "not-found" | "error";
};

/** Deletes today's Gerbang session and detaches its linked records. */
export async function deleteGerbangSessionAction(
    domain: string,
    sessionId: string,
): Promise<DeleteGerbangSessionResult> {
    await enforceTenantOperation(domain, "absensi.gerbang.manage");

    const tenant = await tenantAuthorizationStore.loadTenantByDomain(domain);
    if (!tenant) return { ok: false, code: "not-found" };

    const result = await deleteSession(tenant.id, sessionId);
    if (!result.ok) return { ok: false, code: result.code };

    revalidatePath(`/${domain}/absensi/gerbang`);
    return { ok: true };
}

export type DeleteHistorySessionResult = {
    ok: boolean;
    code?: "not-found" | "error";
};

/** Deletes a session from the history view (detaches its records, keeps them as out-of-session). */
export async function deleteHistorySessionAction(
    domain: string,
    sessionId: string,
): Promise<DeleteHistorySessionResult> {
    await enforceTenantOperation(domain, "absensi.history.delete");

    const tenant = await tenantAuthorizationStore.loadTenantByDomain(domain);
    if (!tenant) return { ok: false, code: "not-found" };

    const result = await deleteSession(tenant.id, sessionId);
    if (!result.ok) return { ok: false, code: result.code };

    revalidatePath(`/${domain}/absensi/history`);
    return { ok: true };
}

export type DeleteHistoryRecordResult = {
    ok: boolean;
    code?: "not-found" | "error";
};

/** Deletes a single attendance record from the history detail view. */
export async function deleteHistoryRecordAction(
    domain: string,
    recordId: string,
): Promise<DeleteHistoryRecordResult> {
    await enforceTenantOperation(domain, "absensi.history.delete");

    const tenant = await tenantAuthorizationStore.loadTenantByDomain(domain);
    if (!tenant) return { ok: false, code: "not-found" };

    const result = await deleteAttendanceRecord(tenant.id, recordId);
    if (!result.ok) return { ok: false, code: result.code };

    revalidatePath(`/${domain}/absensi/history`);
    return { ok: true };
}
