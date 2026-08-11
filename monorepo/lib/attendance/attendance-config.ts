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
 * Active configuration: which mode is bound to which layer. A layer is only
 * present when the School Admin activated it. Reads stay tolerant — a layer may
 * reference a mode that the Provider later disables; pruning happens on save.
 */
export type AbsensiSettings = {
    activeLayers: Partial<Record<AttendanceLayer, AttendanceMode>>;
};

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
    return { activeLayers };
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