"use client";

import { useActionState, useState } from "react";

import { saveAbsensiConfigAction, type SaveAbsensiConfigResult } from "@/app/(tenant)/[domain]/(authenticated)/absensi/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
    ATTENDANCE_LAYER_LABELS,
    ATTENDANCE_LAYERS,
    ATTENDANCE_MODE_LABELS,
    type AttendanceLayer,
    type AttendanceMode,
} from "@/lib/attendance/attendance-config";

type LayerState = {
    enabled: boolean;
    modes: AttendanceMode[];
};

function initialLayerState(
    layer: AttendanceLayer,
    activeLayers: Partial<Record<AttendanceLayer, AttendanceMode[]>>,
    allowedModes: readonly AttendanceMode[],
): LayerState {
    const current = activeLayers[layer] ?? [];
    const enabled = current.length > 0;
    const modes = current.filter((m) => allowedModes.includes(m));
    return { enabled, modes };
}

export function AbsensiSettingsForm({
    domain,
    allowedModes,
    allowedLayers,
    activeLayers,
}: {
    domain: string;
    allowedModes: readonly AttendanceMode[];
    allowedLayers: readonly AttendanceLayer[];
    activeLayers: Partial<Record<AttendanceLayer, AttendanceMode[]>>;
}) {
    const [, formAction, pending] = useActionState<SaveAbsensiConfigResult, FormData>(
        (_state, formData) => saveAbsensiConfigAction(domain, formData),
        { ok: true },
    );

    const [layers, setLayers] = useState<Record<AttendanceLayer, LayerState>>(() =>
        Object.fromEntries(
            ATTENDANCE_LAYERS.map((layer) => [layer, initialLayerState(layer, activeLayers, allowedModes)]),
        ) as Record<AttendanceLayer, LayerState>,
    );

    function toggleMode(layer: AttendanceLayer, mode: AttendanceMode, checked: boolean) {
        setLayers((prev) => {
            const current = prev[layer].modes;
            const modes = checked ? [...current, mode] : current.filter((m) => m !== mode);
            return { ...prev, [layer]: { ...prev[layer], modes } };
        });
    }

    return (
        <form action={formAction} className="space-y-6">
            {ATTENDANCE_LAYERS.map((layer) => {
                const layerAllowed = allowedLayers.includes(layer);
                const state = layers[layer];
                const disabled = !layerAllowed || pending;
                return (
                    <fieldset
                        key={layer}
                        disabled={disabled}
                        className="rounded-lg border bg-card text-card-foreground shadow-sm p-6"
                    >
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <Label className="text-base font-semibold">{ATTENDANCE_LAYER_LABELS[layer]}</Label>
                                {!layerAllowed ? (
                                    <p className="text-sm text-muted-foreground">Dinonaktifkan oleh Provider.</p>
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        Aktifkan lapisan ini, lalu pilih satu atau lebih mode pencatatan.
                                    </p>
                                )}
                            </div>
                            <Switch
                                checked={state.enabled}
                                onCheckedChange={(checked) =>
                                    setLayers((prev) => ({ ...prev, [layer]: { ...prev[layer], enabled: checked } }))
                                }
                                disabled={!layerAllowed}
                                aria-label={`Aktifkan lapisan ${ATTENDANCE_LAYER_LABELS[layer]}`}
                            />
                        </div>

                        <div className="mt-4 flex flex-wrap gap-4">
                            {allowedModes.map((mode) => {
                                const checked = state.modes.includes(mode);
                                const id = `mode-${layer}-${mode}`;
                                return (
                                    <div key={mode} className="flex items-center gap-2">
                                        <Checkbox
                                            id={id}
                                            checked={checked}
                                            disabled={!state.enabled || !layerAllowed}
                                            onCheckedChange={(value) => toggleMode(layer, mode, value === true)}
                                        />
                                        <Label htmlFor={id} className="font-normal">{ATTENDANCE_MODE_LABELS[mode]}</Label>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Hidden inputs carry the resolved state to the server action. */}
                        <input type="hidden" name={`layer-enabled:${layer}`} value={state.enabled ? "on" : ""} />
                        {allowedModes.map((mode) => (
                            <input
                                key={mode}
                                type="hidden"
                                name={`mode:${layer}:${mode}`}
                                value={state.modes.includes(mode) ? "on" : ""}
                            />
                        ))}
                    </fieldset>
                );
            })}

            <Button type="submit" disabled={pending}>
                {pending ? "Menyimpan…" : "Simpan pengaturan"}
            </Button>
        </form>
    );
}
