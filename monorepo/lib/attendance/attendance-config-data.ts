import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { tenant } from "@/db/schema";
import type { TenantFeatureKey } from "@/config/tenant-features";
import { isTenantFeatureEnabled } from "@/lib/features/tenant-feature-policy";
import {
    ATTENDANCE_LAYERS,
    ATTENDANCE_LAYER_FEATURE,
    ATTENDANCE_MODES,
    ATTENDANCE_MODE_FEATURE,
    filterAllowedActiveLayers,
    mergeAbsensiSettings,
    readAbsensiSettings,
    type AbsensiConfig,
    type AttendanceLayer,
    type AttendanceMode,
    type AttendanceModeList,
    type ModeSettings,
    type SessionWindow,
} from "@/lib/attendance/attendance-config";

function resolveAllowedModes(settings: unknown): AttendanceMode[] {
    return ATTENDANCE_MODES.filter((mode) =>
        isTenantFeatureEnabled(settings, ATTENDANCE_MODE_FEATURE[mode] as TenantFeatureKey),
    );
}

function resolveAllowedLayers(settings: unknown): AttendanceLayer[] {
    return ATTENDANCE_LAYERS.filter((layer) =>
        isTenantFeatureEnabled(settings, ATTENDANCE_LAYER_FEATURE[layer] as TenantFeatureKey),
    );
}

/** Reads the effective Absensi config for a tenant (allowed set + active bindings). */
export async function getAbsensiConfig(tenantId: string): Promise<AbsensiConfig> {
    const [row] = await db
        .select({ settings: tenant.settings })
        .from(tenant)
        .where(eq(tenant.id, tenantId))
        .limit(1);

    const settings = row?.settings;
    const allowedModes = resolveAllowedModes(settings);
    const allowedLayers = resolveAllowedLayers(settings);
    return {
        allowedModes,
        allowedLayers,
        activeLayers: filterAllowedActiveLayers(settings, allowedModes, allowedLayers),
    };
}

/**
 * Persists the requested layer→mode bindings, clamped to the Provider-allowed
 * set. Returns the resulting config, or null when the tenant does not exist.
 */
export async function saveAbsensiConfig(
    tenantId: string,
    requestedLayers: Partial<Record<AttendanceLayer, AttendanceMode[] | null | undefined>>,
): Promise<AbsensiConfig | null> {
    return db.transaction(async (tx) => {
        const [row] = await tx
            .select({ settings: tenant.settings })
            .from(tenant)
            .where(eq(tenant.id, tenantId))
            .limit(1)
            .for("update");
        if (!row) return null;

        const allowedModes = resolveAllowedModes(row.settings);
        const allowedLayers = resolveAllowedLayers(row.settings);
        const next = mergeAbsensiSettings(row.settings, requestedLayers, allowedModes, allowedLayers);

        await tx
            .update(tenant)
            .set({ settings: mergeAbsensiSettingsIntoSettings(row.settings, next) })
            .where(eq(tenant.id, tenantId));

        return { allowedModes, allowedLayers, activeLayers: next.activeLayers };
    });
}

/**
 * Persists per-mode settings (message, scan window) for an allowed mode,
 * clamped to the Provider-allowed set. Returns the resulting config, or null
 * when the tenant does not exist.
 */
export async function saveModeSettings(
    tenantId: string,
    mode: AttendanceMode,
    next: ModeSettings,
): Promise<AbsensiConfig | null> {
    return db.transaction(async (tx) => {
        const [row] = await tx
            .select({ settings: tenant.settings })
            .from(tenant)
            .where(eq(tenant.id, tenantId))
            .limit(1)
            .for("update");
        if (!row) return null;

        const allowedModes = resolveAllowedModes(row.settings);
        const allowedLayers = resolveAllowedLayers(row.settings);
        if (!(allowedModes as readonly string[]).includes(mode)) return null;

        const base = readAbsensiSettings(row.settings);
        const modeSettings: Partial<Record<AttendanceMode, ModeSettings>> = {
            ...base.modeSettings,
            [mode]: { ...next },
        };
        await tx
            .update(tenant)
            .set({ settings: mergeAbsensiSettingsIntoSettings(row.settings, { activeLayers: base.activeLayers, sessionWindow: base.sessionWindow, modeSettings }) })
            .where(eq(tenant.id, tenantId));

        return { allowedModes, allowedLayers, activeLayers: base.activeLayers };
    });
}

/** Writes the absensi block into the tenant settings object without mutating input. */
function mergeAbsensiSettingsIntoSettings(
    settings: unknown,
    next: {
        activeLayers: Partial<Record<AttendanceLayer, AttendanceModeList>>;
        sessionWindow?: Partial<Record<AttendanceLayer, SessionWindow>>;
        modeSettings?: Partial<Record<AttendanceMode, ModeSettings>>;
    },
): Record<string, unknown> {
    const base = settings && typeof settings === "object" ? { ...(settings as Record<string, unknown>) } : {};
    const prev = readAbsensiSettings(settings);
    base.absensi = {
        activeLayers: { ...next.activeLayers },
        sessionWindow: { ...prev.sessionWindow, ...next.sessionWindow },
        modeSettings: { ...prev.modeSettings, ...next.modeSettings },
    };
    return base;
}
