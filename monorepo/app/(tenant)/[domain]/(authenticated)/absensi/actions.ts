"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { enforceTenantOperation } from "@/lib/features/tenant-feature-route-access";
import { tenantAuthorizationStore } from "@/lib/authorization/tenant-authorization-data";
import { saveAbsensiConfig } from "@/lib/attendance/attendance-config-data";
import {
    ATTENDANCE_LAYERS,
    isAttendanceLayer,
    isAttendanceMode,
    type AttendanceLayer,
    type AttendanceMode,
} from "@/lib/attendance/attendance-config";

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
