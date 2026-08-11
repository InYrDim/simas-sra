"use client";

import { useActionState, useState } from "react";

import { saveAbsensiConfigAction, type SaveAbsensiConfigResult } from "@/app/(tenant)/[domain]/(authenticated)/absensi/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    ATTENDANCE_LAYER_LABELS,
    ATTENDANCE_LAYERS,
    ATTENDANCE_MODE_LABELS,
    type AttendanceLayer,
    type AttendanceMode,
} from "@/lib/attendance/attendance-config";

type LayerState = {
    enabled: boolean;
    mode: AttendanceMode | "";
};

function initialLayerState(
    layer: AttendanceLayer,
    activeLayers: Partial<Record<AttendanceLayer, AttendanceMode>>,
    allowedModes: readonly AttendanceMode[],
): LayerState {
    const current = activeLayers[layer];
    const enabled = Boolean(current);
    const mode = current && allowedModes.includes(current) ? current : allowedModes[0] ?? "";
    return { enabled, mode };
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
    activeLayers: Partial<Record<AttendanceLayer, AttendanceMode>>;
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

    function updateLayer(layer: AttendanceLayer, next: Partial<LayerState>) {
        setLayers((prev) => ({ ...prev, [layer]: { ...prev[layer], ...next } }));
    }

    return (
        <form action={formAction} className="space-y-6">
            {ATTENDANCE_LAYERS.map((layer) => {
                const layerAllowed = allowedLayers.includes(layer);
                const state = layers[layer];
                const disabled = !layerAllowed || pending;
                const submittedMode = state.enabled ? state.mode : "";
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
                                        Aktifkan lapisan ini dan pilih mode pencatatan.
                                    </p>
                                )}
                            </div>
                            <Switch
                                checked={state.enabled}
                                onCheckedChange={(checked) => updateLayer(layer, { enabled: checked })}
                                disabled={!layerAllowed}
                                aria-label={`Aktifkan lapisan ${ATTENDANCE_LAYER_LABELS[layer]}`}
                            />
                        </div>

                        <div className="mt-4 flex items-center gap-3">
                            <Label htmlFor={`mode-${layer}`} className="shrink-0">Mode</Label>
                            <Select
                                value={submittedMode}
                                onValueChange={(value) => updateLayer(layer, { mode: (value ?? "") as AttendanceMode | "" })}
                                disabled={!state.enabled || !layerAllowed}
                            >
                                <SelectTrigger id={`mode-${layer}`} className="w-48">
                                    <SelectValue placeholder="Pilih mode" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">Tanpa mode</SelectItem>
                                    {allowedModes.map((mode) => (
                                        <SelectItem key={mode} value={mode}>
                                            {ATTENDANCE_MODE_LABELS[mode]}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Hidden inputs carry the resolved state to the server action. */}
                        <input type="hidden" name={`layer-enabled:${layer}`} value={state.enabled ? "on" : ""} />
                        <input type="hidden" name={`layer:${layer}`} value={submittedMode} />
                    </fieldset>
                );
            })}

            <Button type="submit" disabled={pending}>
                {pending ? "Menyimpan…" : "Simpan pengaturan"}
            </Button>
        </form>
    );
}
