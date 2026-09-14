"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { enforceTenantOperation } from "@/lib/features/tenant-feature-route-access";
import { OpenWaClient } from "@/lib/integrations/whatsapp-bot/openwa-client";
import { resolveTenantOpenWaCredential } from "@/lib/integrations/whatsapp-bot/tenant-openwa-credential";
import { readConnectionByTenantId, recordOutboundMessage } from "@/lib/integrations/whatsapp-bot/whatsapp-bot-data";
import type { WhatsAppBotSendDependencies } from "@/lib/integrations/whatsapp-bot/whatsapp-bot-send";
import { tenantAuthorizationStore } from "@/lib/authorization/tenant-authorization-data";
import { saveAbsensiConfig, saveModeSettings } from "@/lib/attendance/attendance-config-data";
import { recordAttendance, openSession, closeSession, deleteSession, deleteAttendanceRecord, getSessionById } from "@/lib/attendance/attendance-record-data";
import { sendAttendanceNotification } from "@/lib/attendance/attendance-notify";
import { decodeQrToken } from "@/lib/attendance/attendance-qr";
import { getSessionWindow, readAbsensiSettings, readTenantTimezone } from "@/lib/attendance/attendance-config";
import {
    ATTENDANCE_LAYERS,
    ATTENDANCE_MODES,
    isAttendanceLayer,
    isAttendanceMode,
    isSessionWindow,
    type AttendanceLayer,
    type AttendanceMode,
} from "@/lib/attendance/attendance-config";
import { isAttendanceRecordStatus, isStatusValidForLayer } from "@/lib/attendance/attendance-record";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { classMembership } from "@/db/schema";

export type SaveAbsensiConfigResult = {
    ok: boolean;
    code?: "invalid-input" | "not-found" | "error";
};

function waSendDependencies(): WhatsAppBotSendDependencies {
    return {
        resolveCredential: resolveTenantOpenWaCredential,
        createClient: (config) => new OpenWaClient({ config }),
        readConnectionByTenantId,
        recordOutboundMessage,
    };
}

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

    const requested: Partial<Record<AttendanceLayer, AttendanceMode[] | null>> = {};
    for (const layer of ATTENDANCE_LAYERS) {
        const enabled = formData.get(`layer-enabled:${layer}`);
        if (enabled !== "on") {
            // Layer toggled off (or not present): drop any binding for this layer.
            requested[layer] = null;
            continue;
        }
        const selected: AttendanceMode[] = [];
        for (const mode of ATTENDANCE_MODES) {
            if (formData.get(`mode:${layer}:${mode}`) === "on") selected.push(mode);
        }
        // A layer with no mode checked is treated as inactive (dropped on save).
        requested[layer] = selected.length > 0 ? selected : null;
    }

    // Unknown layer/mode keys in the form are rejected; only known layers/modes honored.
    for (const key of formData.keys()) {
        if (key.startsWith("mode:")) {
            const rest = key.slice("mode:".length);
            const sep = rest.indexOf(":");
            if (sep === -1) return { ok: false, code: "invalid-input" };
            const layer = rest.slice(0, sep);
            const mode = rest.slice(sep + 1);
            if (!isAttendanceLayer(layer) || !isAttendanceMode(mode)) {
                return { ok: false, code: "invalid-input" };
            }
        } else if (key.startsWith("layer-enabled:")) {
            const layer = key.slice("layer-enabled:".length);
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

export type SaveModeSettingsResult = {
    ok: boolean;
    code?: "invalid-input" | "not-found" | "not-allowed" | "error";
};

/**
 * Persists per-mode settings (message, scan window) for an allowed mode. The
 * mode is re-checked against the Provider-allowed set server-side, so a mode
 * the Provider disabled cannot be configured regardless of client input.
 */
export async function saveModeSettingsAction(
    domain: string,
    mode: string,
    formData: FormData,
): Promise<SaveModeSettingsResult> {
    await enforceTenantOperation(domain, "absensi.settings.save");
    if (!isAttendanceMode(mode)) return { ok: false, code: "invalid-input" };

    const message = String(formData.get("message") ?? "").trim() || undefined;
    const rawStart = String(formData.get("scanStart") ?? "").trim();
    const rawEnd = String(formData.get("scanEnd") ?? "").trim();
    const scanWindow =
        rawStart !== "" && rawEnd !== "" && isSessionWindow({ start: rawStart, end: rawEnd })
            ? { start: rawStart, end: rawEnd }
            : undefined;
    const notifyEnabled = formData.get("notifyEnabled") === "on";
    const notifyMessage = String(formData.get("notifyMessage") ?? "").trim() || undefined;

    const tenant = await tenantAuthorizationStore.loadTenantByDomain(domain);
    if (!tenant) return { ok: false, code: "not-found" };

    const result = await saveModeSettings(tenant.id, mode, { message, scanWindow, notifyEnabled, notifyMessage });
    if (!result) return { ok: false, code: "not-allowed" };

    revalidatePath(`/${domain}/absensi/settings`);
    revalidatePath(`/${domain}/absensi/settings/modes`);
    revalidatePath(`/${domain}/absensi/settings/modes/${mode}`);
    redirect(`/${domain}/absensi/settings/modes/${mode}?result=saved`);
}

export type RecordGerbangResult = {
    ok: boolean;
    code?: "invalid-input" | "student-not-found" | "invalid-status" | "duplicate" | "not-found" | "error";
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
        return { ok: false, code: result.code === "student-not-found" ? "student-not-found" : result.code === "invalid-status" ? "invalid-status" : result.code === "duplicate" ? "duplicate" : "error" };
    }

    await sendAttendanceNotification(waSendDependencies(), {
        tenantId: tenant.id,
        tenantSettings: tenant.settings,
        studentId,
        layer: "gerbang",
        mode: "manual",
        status,
        recordedAt: new Date(),
    }).catch(() => undefined);

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

    const result = await deleteSession(tenant.id, sessionId, { deleteRecords: true });
    if (!result.ok) return { ok: false, code: result.code };

    revalidatePath(`/${domain}/absensi/gerbang`);
    return { ok: true };
}

export type RecordKelasResult = {
    ok: boolean;
    code?: "invalid-input" | "student-not-found" | "invalid-status" | "not-in-rombel" | "duplicate" | "not-found" | "error";
};

/**
 * Records a Kelas (classroom) attendance event in Manual mode. The operator
 * (the logged-in user) selects the student and the classroom status
 * (hadir/izin/sakit/alpa). The write path is shared with Gerbang via
 * `recordAttendance`; only the layer, status vocabulary, and actor differ.
 */
export async function recordKelasAction(
    domain: string,
    formData: FormData,
): Promise<RecordKelasResult> {
    const principal = await enforceTenantOperation(domain, "absensi.kelas.record");

    const studentId = String(formData.get("studentId") ?? "").trim();
    const status = String(formData.get("status") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim() || undefined;

    if (studentId === "" || !isAttendanceRecordStatus(status) || !isStatusValidForLayer("kelas", status)) {
        return { ok: false, code: "invalid-input" };
    }

    const tenant = await tenantAuthorizationStore.loadTenantByDomain(domain);
    if (!tenant) return { ok: false, code: "not-found" };

    // Kelas attendance requires an active rombel membership (endedAt IS NULL).
    const membership = await db
        .select({ id: classMembership.id })
        .from(classMembership)
        .where(and(
            eq(classMembership.tenantId, tenant.id),
            eq(classMembership.studentId, studentId),
            sql`${classMembership.endedAt} IS NULL`,
        ))
        .limit(1);
    if (membership.length === 0) {
        return { ok: false, code: "not-in-rombel" };
    }

    const result = await recordAttendance({
        tenantId: tenant.id,
        studentId,
        layer: "kelas",
        mode: "manual",
        status,
        actorUserId: principal.userId,
        timezone: readTenantTimezone(tenant.settings),
        notes,
    });

    if (!result.ok) {
        return { ok: false, code: result.code === "student-not-found" ? "student-not-found" : result.code === "invalid-status" ? "invalid-status" : result.code === "duplicate" ? "duplicate" : "error" };
    }

    await sendAttendanceNotification(waSendDependencies(), {
        tenantId: tenant.id,
        tenantSettings: tenant.settings,
        studentId,
        layer: "kelas",
        mode: "manual",
        status,
        recordedAt: new Date(),
    }).catch(() => undefined);

    revalidatePath(`/${domain}/absensi/kelas`);
    return { ok: true };
}

export type OpenKelasSessionResult = {
    ok: boolean;
    code?: "already-open" | "invalid-window" | "not-found" | "error";
};

/**
 * Opens a Kelas attendance session for today. The planned window defaults to
 * the tenant's configured `sessionWindow.kelas`, falling back to the default
 * Kelas window when unset or invalid.
 */
export async function openKelasSessionAction(
    domain: string,
    formData?: FormData,
): Promise<OpenKelasSessionResult> {
    const principal = await enforceTenantOperation(domain, "absensi.kelas.manage");

    const tenant = await tenantAuthorizationStore.loadTenantByDomain(domain);
    if (!tenant) return { ok: false, code: "not-found" };

    const settings = readAbsensiSettings(tenant.settings);
    const fallback = getSessionWindow(settings, "kelas");

    const rawStart = formData ? String(formData.get("plannedStart") ?? "").trim() : "";
    const rawEnd = formData ? String(formData.get("plannedEnd") ?? "").trim() : "";
    const window = isSessionWindow({ start: rawStart, end: rawEnd }) ? { start: rawStart, end: rawEnd } : fallback;

    const result = await openSession({
        tenantId: tenant.id,
        layer: "kelas",
        openedByUserId: principal.userId,
        plannedStart: window.start,
        plannedEnd: window.end,
        timezone: readTenantTimezone(tenant.settings),
        notes: formData ? String(formData.get("notes") ?? "").trim() || undefined : undefined,
    });

    if (!result.ok) return { ok: false, code: result.code };
    revalidatePath(`/${domain}/absensi/kelas`);
    return { ok: true };
}

export type CloseKelasSessionResult = {
    ok: boolean;
    code?: "not-found" | "error";
};

/** Closes an open Kelas session. */
export async function closeKelasSessionAction(
    domain: string,
    sessionId: string,
): Promise<CloseKelasSessionResult> {
    await enforceTenantOperation(domain, "absensi.kelas.manage");

    const tenant = await tenantAuthorizationStore.loadTenantByDomain(domain);
    if (!tenant) return { ok: false, code: "not-found" };

    const result = await closeSession(tenant.id, sessionId);
    if (!result.ok) return { ok: false, code: result.code };

    revalidatePath(`/${domain}/absensi/kelas`);
    return { ok: true };
}

export type DeleteKelasSessionResult = {
    ok: boolean;
    code?: "not-found" | "error";
};

/** Deletes today's Kelas session and detaches its linked records. */
export async function deleteKelasSessionAction(
    domain: string,
    sessionId: string,
): Promise<DeleteKelasSessionResult> {
    await enforceTenantOperation(domain, "absensi.kelas.manage");

    const tenant = await tenantAuthorizationStore.loadTenantByDomain(domain);
    if (!tenant) return { ok: false, code: "not-found" };

    const result = await deleteSession(tenant.id, sessionId, { deleteRecords: true });
    if (!result.ok) return { ok: false, code: result.code };

    revalidatePath(`/${domain}/absensi/kelas`);
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

export type RecordQrResult = {
    ok: boolean;
    code?: "invalid-input" | "not-found" | "wrong-tenant" | "bad-token" | "student-not-found" | "invalid-status" | "duplicate" | "error";
    studentName?: string;
    status?: string;
};

/**
 * Records an attendance event from a scanned QR token (Fase 3). The operator
 * (logged-in user) runs the scanner; the student identity, layer, and direction
 * come from the decoded token. Cross-tenant tokens are rejected.
 *
 * - Gerbang session: IN → masuk, OUT → keluar.
 * - Kelas session: both directions map to hadir (a Kelas session records a
 *   single presence status).
 */
export async function recordQrAction(
    domain: string,
    sessionId: string,
    token: string,
): Promise<RecordQrResult> {
    const principal = await enforceTenantOperation(domain, "absensi.qr.record");

    const tenant = await tenantAuthorizationStore.loadTenantByDomain(domain);
    if (!tenant) return { ok: false, code: "not-found" };

    const session = await getSessionById(tenant.id, sessionId);
    if (!session) return { ok: false, code: "not-found" };
    if (session.status !== "open") return { ok: false, code: "not-found" };
    if (session.layer !== "gerbang" && session.layer !== "kelas") return { ok: false, code: "not-found" };

    const decoded = decodeQrToken(token, tenant.npsn);
    if (!decoded.ok) {
        return { ok: false, code: decoded.code === "wrong-tenant" ? "wrong-tenant" : "bad-token" };
    }

    // The token's layer must match the scanning session's layer — a Gerbang
    // session cannot be satisfied by a Kelas QR and vice versa.
    const tokenLayer = decoded.value.layer.toLowerCase();
    if (tokenLayer !== session.layer) return { ok: false, code: "bad-token" };

    const status =
        session.layer === "gerbang"
            ? decoded.value.direction === "IN"
                ? "masuk"
                : "keluar"
            : "hadir";

    const result = await recordAttendance({
        tenantId: tenant.id,
        studentId: decoded.value.studentRef,
        layer: session.layer,
        mode: "qr",
        status,
        actorUserId: principal.userId,
        timezone: readTenantTimezone(tenant.settings),
    });

    if (!result.ok) {
        return { ok: false, code: result.code === "student-not-found" ? "student-not-found" : result.code === "invalid-status" ? "invalid-status" : result.code === "duplicate" ? "duplicate" : "error" };
    }

    await sendAttendanceNotification(waSendDependencies(), {
        tenantId: tenant.id,
        tenantSettings: tenant.settings,
        studentId: decoded.value.studentRef,
        layer: session.layer,
        mode: "qr",
        status,
        recordedAt: new Date(),
    }).catch(() => undefined);

    revalidatePath(`/${domain}/absensi/${session.layer}`);
    return { ok: true, status };
}
