/**
 * Pure, framework-agnostic layer for the Absensi (attendance) configuration.
 *
 * The configuration models a THREE-TIER design:
 *   1. Provider gates which attendance modes AND which layers are allowed per Tenant.
 *   2. School Admin selects which layers are active and binds one allowed mode to each.
 *
 * This module owns the types and the clamp/prune rules. It has no dependency on
 * the database, Next.js, or the request scope, so it stays trivially unit-testable.
 */

export const ATTENDANCE_MODES = ["manual", "qr", "kartu"] as const;
export type AttendanceMode = (typeof ATTENDANCE_MODES)[number];

import type { AttendanceRecordStatus } from "@/lib/attendance/attendance-record";

export const ATTENDANCE_LAYERS = ["gerbang", "kelas"] as const;
export type AttendanceLayer = (typeof ATTENDANCE_LAYERS)[number];

export const ATTENDANCE_MODE_LABELS: Record<AttendanceMode, string> = {
    manual: "Manual",
    qr: "QR",
    kartu: "Kartu",
};

export const ATTENDANCE_LAYER_LABELS: Record<AttendanceLayer, string> = {
    gerbang: "Gerbang",
    kelas: "Kelas",
};

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceRecordStatus, string> = {
    masuk: "Masuk",
    keluar: "Keluar",
    hadir: "Hadir",
    izin: "Izin",
    sakit: "Sakit",
    alpa: "Alpa",
};

/** Maps each attendance mode to the Provider-gated feature key that enables it. */
export const ATTENDANCE_MODE_FEATURE: Record<AttendanceMode, string> = {
    manual: "absensiManual",
    qr: "absensiQr",
    kartu: "absensiKartu",
};

/** Maps each attendance layer to the Provider-gated feature key that enables it. */
export const ATTENDANCE_LAYER_FEATURE: Record<AttendanceLayer, string> = {
    gerbang: "absensiGerbang",
    kelas: "absensiKelas",
};

/**
 * A planned session window for a layer, expressed as "HH:MM" (24h) local time.
 * Used as the default `plannedStart`/`plannedEnd` when a School Admin opens a
 * session for the day.
 */
export type SessionWindow = {
    start: string;
    end: string;
};

/** Default gerbang window when none is configured (06:00–07:30). */
/** Per-mode settings. Only the fields relevant to a mode are honored. */
export type ModeSettings = {
    /** Info text shown on the mode's scan/record surface. */
    message?: string;
    /** Scan session window (QR/Kartu). Overrides the layer default when set. */
    scanWindow?: SessionWindow;
};

export const DEFAULT_GERBANG_SESSION_WINDOW: SessionWindow = { start: "06:00", end: "07:30" };

/**
 * Active configuration: which mode is bound to which layer. A layer is only
 * present when the School Admin activated it. Reads stay tolerant — a layer may
 * reference a mode that the Provider later disables; pruning happens on save.
 */
export type AbsensiSettings = {
    activeLayers: Partial<Record<AttendanceLayer, AttendanceMode>>;
    sessionWindow?: Partial<Record<AttendanceLayer, SessionWindow>>;
    modeSettings?: Partial<Record<AttendanceMode, ModeSettings>>;
};

/** Matches "HH:MM" with hours 00–23 and minutes 00–59. */
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isSessionWindow(value: unknown): value is SessionWindow {
    if (!value || typeof value !== "object") return false;
    const v = value as Record<string, unknown>;
    return (
        typeof v.start === "string" &&
        typeof v.end === "string" &&
        TIME_PATTERN.test(v.start) &&
        TIME_PATTERN.test(v.end) &&
        v.end > v.start
    );
}

export type AbsensiConfig = {
    allowedModes: readonly AttendanceMode[];
    allowedLayers: readonly AttendanceLayer[];
    activeLayers: Partial<Record<AttendanceLayer, AttendanceMode>>;
};

export function isAttendanceMode(value: unknown): value is AttendanceMode {
    return typeof value === "string" && (ATTENDANCE_MODES as readonly string[]).includes(value);
}

export function isAttendanceLayer(value: unknown): value is AttendanceLayer {
    return typeof value === "string" && (ATTENDANCE_LAYERS as readonly string[]).includes(value);
}

/**
 * Reads the tenant's IANA timezone from its settings JSON. SIMAS is an
 * Indonesian school system, so an unset timezone defaults to WIB (Asia/Jakarta)
 * rather than UTC — otherwise early-morning sessions would be filed under the
 * wrong civil date and become invisible to session resolution.
 */
export function readTenantTimezone(settings: unknown): string {
    const safe = settings && typeof settings === "object" ? settings : {};
    const tz = (safe as Record<string, unknown>).timezone;
    return typeof tz === "string" && tz.trim() !== "" ? tz : "Asia/Jakarta";
}

/** Reads the stored settings, defaulting to an empty (no active layers) config. */
export function readAbsensiSettings(settings: unknown): AbsensiSettings {
    const safe = settings && typeof settings === "object" ? settings : {};
    const raw = (safe as Record<string, unknown>).absensi;
    const source = raw && typeof raw === "object" ? raw : {};
    const stored = (source as Record<string, unknown>).activeLayers;
    const activeLayers: Partial<Record<AttendanceLayer, AttendanceMode>> = {};
    if (stored && typeof stored === "object") {
        for (const layer of ATTENDANCE_LAYERS) {
            const mode = (stored as Record<string, unknown>)[layer];
            if (isAttendanceMode(mode)) activeLayers[layer] = mode;
        }
    }
    const storedWindow = (source as Record<string, unknown>).sessionWindow;
    const sessionWindow: Partial<Record<AttendanceLayer, SessionWindow>> = {};
    if (storedWindow && typeof storedWindow === "object") {
        for (const layer of ATTENDANCE_LAYERS) {
            const win = (storedWindow as Record<string, unknown>)[layer];
            if (isSessionWindow(win)) sessionWindow[layer] = win;
        }
    }
    const storedModes = (source as Record<string, unknown>).modeSettings;
    const modeSettings: Partial<Record<AttendanceMode, ModeSettings>> = {};
    if (storedModes && typeof storedModes === "object") {
        for (const mode of ATTENDANCE_MODES) {
            const m = (storedModes as Record<string, unknown>)[mode];
            if (m && typeof m === "object") {
                const mv = m as Record<string, unknown>;
                const ms: ModeSettings = {};
                if (typeof mv.message === "string") ms.message = mv.message;
                if (isSessionWindow(mv.scanWindow)) ms.scanWindow = mv.scanWindow;
                modeSettings[mode] = ms;
            }
        }
    }
    return { activeLayers, sessionWindow, modeSettings };
}

/**
 * Returns the effective session window for a layer: the configured window if
 * valid, otherwise the layer default. Gerbang defaults to 06:30–07:30.
 */
export function getSessionWindow(
    settings: unknown,
    layer: AttendanceLayer,
): SessionWindow {
    const s = readAbsensiSettings(settings);
    const configured = s.sessionWindow?.[layer];
    if (isSessionWindow(configured)) return configured;
    // A QR layer may carry its own scan window in mode settings.
    if (s.activeLayers[layer] === "qr") {
        const qrWindow = s.modeSettings?.qr?.scanWindow;
        if (isSessionWindow(qrWindow)) return qrWindow;
    }
    if (layer === "gerbang") return DEFAULT_GERBANG_SESSION_WINDOW;
    return { start: "07:00", end: "15:00" };
}

/**
 * Merges a requested layer→mode binding against the Provider-allowed set.
 *
 * - Layers not in `allowedLayers` are dropped (prune-on-save).
 * - Modes not in `allowedModes` are dropped for that layer.
 * - Unknown layer/mode values are ignored.
 *
 * Returns a fresh object; the input is never mutated.
 */
export function mergeAbsensiSettings(
    settings: unknown,
    next: Partial<Record<AttendanceLayer, AttendanceMode | null | undefined>>,
    allowedModes: readonly AttendanceMode[],
    allowedLayers: readonly AttendanceLayer[],
): AbsensiSettings {
    const base = readAbsensiSettings(settings);
    const activeLayers: Partial<Record<AttendanceLayer, AttendanceMode>> = {};

    for (const layer of allowedLayers) {
        const requested = next[layer];
        if (requested === null) {
            // Explicit clear: drop any binding for this layer.
            continue;
        }
        const mode = requested ?? base.activeLayers[layer];
        if (mode && (allowedModes as readonly string[]).includes(mode)) {
            activeLayers[layer] = mode;
        }
    }

    return { activeLayers };
}
/**
 * Returns only the active layer→mode bindings that the Provider still allows.
 *
 * Reads stay tolerant: a binding may reference a layer/mode the Provider later
 * disabled, so the stored value is NOT mutated. This filter is applied at read
 * time so the UI never shows a layer the Provider switched off, while the raw
 * binding survives in the DB (and returns automatically if the Provider
 * re-enables it). Pruning from the DB still happens on the next save via
 * `mergeAbsensiSettings`.
 */
export function filterAllowedActiveLayers(
    settings: unknown,
    allowedModes: readonly AttendanceMode[],
    allowedLayers: readonly AttendanceLayer[],
): Partial<Record<AttendanceLayer, AttendanceMode>> {
    const stored = readAbsensiSettings(settings).activeLayers;
    const activeLayers: Partial<Record<AttendanceLayer, AttendanceMode>> = {};
    for (const layer of allowedLayers) {
        const mode = stored[layer];
        if (mode && (allowedModes as readonly string[]).includes(mode)) {
            activeLayers[layer] = mode;
        }
    }
    return activeLayers;
}