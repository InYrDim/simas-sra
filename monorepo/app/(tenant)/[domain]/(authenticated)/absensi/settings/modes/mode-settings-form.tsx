"use client";

import { useActionState } from "react";

import { saveModeSettingsAction, type SaveModeSettingsResult } from "@/app/(tenant)/[domain]/(authenticated)/absensi/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ModeSettingsForm({
    domain,
    mode,
    message,
    scanStart,
    scanEnd,
}: {
    domain: string;
    mode: string;
    message: string;
    scanStart: string;
    scanEnd: string;
}) {
    const [, formAction, pending] = useActionState<SaveModeSettingsResult, FormData>(
        (_state, formData) => saveModeSettingsAction(domain, mode, formData),
        { ok: true },
    );

    return (
        <form action={formAction} className="space-y-6 rounded-lg border bg-card text-card-foreground shadow-sm p-6">
            <div className="space-y-2">
                <Label htmlFor="message">Pesan</Label>
                <Input
                    id="message"
                    name="message"
                    defaultValue={message}
                    placeholder="Pesan yang ditampilkan di halaman pindai/pencatatan"
                />
                <p className="text-sm text-muted-foreground">
                    Teks singkat yang muncul di layar pencatatan mode ini.
                </p>
            </div>

            <fieldset className="space-y-2">
                <Legend>Jendela Pindai</Legend>
                <div className="flex flex-wrap items-end gap-3">
                    <div className="space-y-1">
                        <Label htmlFor="scanStart">Mulai</Label>
                        <Input id="scanStart" name="scanStart" type="time" defaultValue={scanStart} className="w-36" />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="scanEnd">Selesai</Label>
                        <Input id="scanEnd" name="scanEnd" type="time" defaultValue={scanEnd} className="w-36" />
                    </div>
                </div>
                <p className="text-sm text-muted-foreground">
                    Format HH:MM. Menggantikan jendela default lapisan bila diisi keduanya.
                </p>
            </fieldset>

            <Button type="submit" disabled={pending}>
                {pending ? "Menyimpan…" : "Simpan pengaturan mode"}
            </Button>
        </form>
    );
}

function Legend({ children }: { children: React.ReactNode }) {
    return <legend className="text-base font-semibold">{children}</legend>;
}
