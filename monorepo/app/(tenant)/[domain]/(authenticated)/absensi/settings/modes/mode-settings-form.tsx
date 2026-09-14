"use client";

import { useActionState, useState, useRef } from "react";

import { saveModeSettingsAction, type SaveModeSettingsResult } from "@/app/(tenant)/[domain]/(authenticated)/absensi/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const EXAMPLE_TEMPLATE = `{{#if gerbang_masuk}}
Yth. Orang tua {nama} ({nis}), anak Anda tercatat MASUK di gerbang pada {waktu}.
{{elseif gerbang_keluar}}
Yth. Orang tua {nama} ({nis}), anak Anda tercatat KELUAR dari gerbang pada {waktu}.
{{elseif kelas_hadir}}
Yth. Orang tua {nama} ({nis}), anak Anda tercatat HADIR di kelas pada {waktu}.
{{elseif kelas_izin}}
Yth. Orang tua {nama} ({nis}), anak Anda tercatat IZIN pada {waktu}.
{{elseif gerbang_izin}}
Yth. Orang tua {nama} ({nis}), anak Anda tercatat IZIN di gerbang pada {waktu}.
{{elseif gerbang_sakit}}
Yth. Orang tua {nama} ({nis}), anak Anda tercatat SAKIT di gerbang pada {waktu}.
{{elseif kelas_sakit}}
Yth. Orang tua {nama} ({nis}), anak Anda tercatat SAKIT di kelas pada {waktu}.
{{elseif kelas_alpa}}
Yth. Orang tua {nama} ({nis}), anak Anda tercatat ALPA di kelas pada {waktu}.
{{else}}
Yth. Orang tua {nama} ({nis}), anak Anda tercatat {status} pada {waktu}.
{{/if}}`;

const AVAILABLE_CONDITIONS = [
  { condition: "gerbang_masuk", label: "Gerbang - Masuk" },
  { condition: "gerbang_keluar", label: "Gerbang - Keluar" },
  { condition: "gerbang_izin", label: "Gerbang - Izin" },
  { condition: "gerbang_sakit", label: "Gerbang - Sakit" },
  { condition: "kelas_hadir", label: "Kelas - Hadir" },
  { condition: "kelas_izin", label: "Kelas - Izin" },
  { condition: "kelas_sakit", label: "Kelas - Sakit" },
  { condition: "kelas_alpa", label: "Kelas - Alpa" },
];

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
    const [templateValue, setTemplateValue] = useState(notifyMessage ?? "");
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    function insertExample() {
        setTemplateValue(EXAMPLE_TEMPLATE);
        textareaRef.current?.focus();
    }

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
                    <div className="flex items-center justify-between gap-2">
                        <Label htmlFor="notifyMessage">Pesan Notifikasi WA</Label>
                        <Button type="button" variant="outline" size="sm" onClick={insertExample}>
                            Isi contoh template kondisional
                        </Button>
                    </div>
                    <Textarea
                        ref={textareaRef}
                        id="notifyMessage"
                        name="notifyMessage"
                        value={templateValue}
                        onChange={(event) => setTemplateValue(event.target.value)}
                        placeholder="Yth. Orang tua {nama} ({nis}), anak Anda tercatat {status} pada {waktu}."
                        rows={6}
                    />
                    <div className="space-y-1">
                        <p className="text-sm font-medium">Kondisi yang tersedia:</p>
                        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                            {AVAILABLE_CONDITIONS.map((item) => (
                                <li key={item.condition}>
                                    <code>{`{{#if ${item.condition}}}`}</code>{" "}
                                    <span className="text-muted-foreground">{item.label}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Variabel: <code>{'{nama}'}</code> <code>{'{nis}'}</code> <code>{'{status}'}</code> <code>{'{waktu}'}</code> <code>{'{layer}'}</code>
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
