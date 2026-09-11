"use client";

import { useActionState } from "react";
import { Send, CheckCircle2 } from "lucide-react";

import { sendWhatsAppMessageAction } from "@/app/(tenant)/[domain]/(authenticated)/integrasi/whatsapp/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

export type SendFormState = {
  ok: boolean;
  code?: string;
  messageId?: string;
};

function sendErrorText(code: string): string {
  switch (code) {
    case "unconfigured":
      return "Kredensial OpenWA untuk sekolah ini belum disiapkan Provider. Hubungi tim SIMAS.";
    case "not-connected":
      return "WhatsApp Bot belum terhubung. Hubungkan dahulu sebelum mengirim pesan.";
    case "session-not-ready":
      return "Session WhatsApp sedang tidak aktif (reconnecting/mengulang). Coba beberapa saat lagi.";
    case "recipient-invalid":
      return "Nomor tujuan tidak dapat dijangkau atau format chat ID tidak dikenali. Pastikan formatnya benar (contoh: 62812xxxxxxx tanpa tanda +).";
    case "openwa-unreachable":
      return "Server OpenWA tidak dapat dijangkau. Coba lagi setelah Provider memeriksa konfigurasi.";
    default:
      return "Terjadi kesalahan saat mengirim pesan. Coba lagi.";
  }
}

export function WhatsAppBotComposer({ domain }: { domain: string }) {
  const [state, formAction, pending] = useActionState<SendFormState, FormData>(
    (_prev, formData) =>
      sendWhatsAppMessageAction(domain, {
        chatId: String(formData.get("chatId") ?? ""),
        text: String(formData.get("text") ?? ""),
      }),
    { ok: true },
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="whatsapp-chat-id">Nomor tujuan / Chat ID</Label>
        <Input
          id="whatsapp-chat-id"
          name="chatId"
          required
          autoComplete="off"
          inputMode="tel"
          placeholder="62812xxxxxxx jumlah penuh, tanpa tanda +"
          className="font-mono"
        />
        <p className="text-xs text-muted-foreground">
          Gunakan nomor dalam format internasional, misal <span className="font-mono">628123456789</span>. ID group
          WhatsApp juga didukung (akhiran <span className="font-mono">@g.us</span>).
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="whatsapp-message-text">Isi pesan</Label>
        <Textarea
          id="whatsapp-message-text"
          name="text"
          required
          rows={3}
          maxLength={4096}
          placeholder="Tulis pesan yang ingin dikirim…"
        />
      </div>

      {state.ok === false ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {sendErrorText(state.code ?? "error")}
        </p>
      ) : null}
      {state.ok === true && state.messageId ? (
        <p className="flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-700">
          <CheckCircle2 aria-hidden="true" className="size-4 shrink-0" />
          Pesan terkirim ke WhatsApp network.
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? <Spinner aria-hidden="true" /> : <Send aria-hidden="true" />}
          {pending ? "Mengirim…" : "Kirim Pesan"}
        </Button>
      </div>
    </form>
  );
}