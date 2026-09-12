"use client";

import { useActionState } from "react";

import { saveModeSettingsAction, type SaveModeSettingsResult } from "@/app/(tenant)/[domain]/(authenticated)/absensi/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export function ModeSettingsForm({
    domain,
    mode,
    message,
    scanStart,
    scanEnd,
    notifyEnabled,
    notifyMessage,
}: {
    domain: string;
    mode: string;
    message: string;
    scanStart: string;
    scanEnd: string;
    notifyEnabled?: boolean;
    notifyMessage?: string;
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

            <fieldset className="space-y-3">
                <Legend>Notifikasi WhatsApp</Legend>
                <div className="flex items-center gap-2">
                    <Switch id="notifyEnabled" name="notifyEnabled" defaultChecked={notifyEnabled} />
                    <Label htmlFor="notifyEnabled">Kirim notifikasi WA saat absensi dicatat</Label>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="notifyMessage">Pesan Notifikasi WA</Label>
                    <Textarea
                        id="notifyMessage"
                        name="notifyMessage"
                        defaultValue={notifyMessage ?? ""}
                        placeholder="Yth. Orang tua {nama} ({nis}), anak Anda tercatat {status} pada {waktu}."
                        rows={3}
                    />
                    <p className="text-sm text-muted-foreground">
                        Placeholder: <code>{'{nama}'}</code> <code>{'{nis}'}</code> <code>{'{status}'}</code> <code>{'{waktu}'}</code> <code>{'{layer}'}</code>
                    </p>
                </div>
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
