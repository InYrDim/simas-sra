"use client";

import { useState, useActionState, startTransition } from "react";
import { Link2, Unlink } from "lucide-react";

import { connectWhatsAppBotAction, disconnectWhatsAppBotAction } from "@/app/(tenant)/[domain]/(authenticated)/integrasi/whatsapp/actions";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export type WhatsAppBotConnectionView = {
  openwaSessionId: string | null;
  openwaSessionName: string | null;
  botPhone: string | null;
  botPushName: string | null;
  status: "connected" | "error";
};

function connectErrorText(code: string): string {
  switch (code) {
    case "unconfigured":
      return "Kredensial OpenWA untuk sekolah ini belum disiapkan Provider. Hubungi tim SIMAS.";
    case "session-not-found":
      return "Session WhatsApp belum ditemukan atau belum siap (status bukan Ready) di server OpenWA. Pastikan Provider sudah mengisi kredensial dan men-scan QR session-nya.";
    case "session-in-use":
      return "Session WhatsApp tersebut sudah digunakan sekolah lain.";
    case "webhook-failed":
      return "Gagal mendaftarkan webhook di OpenWA. Coba lagi.";
    case "openwa-unreachable":
      return "Server OpenWA tidak dapat dijangkau. Muat ulang setelah Provider memeriksa konfigurasi.";
    default:
      return "Terjadi kesalahan saat menghubungkan. Coba lagi.";
  }
}

function disconnectErrorText(code: string): string {
  switch (code) {
    case "openwa-unreachable":
      return "Server OpenWA tidak dapat dijangkau sehingga webhook belum dihapus. Koneksi lokal dipertahankan; coba lagi nanti.";
    default:
      return "Terjadi kesalahan saat memutuskan koneksi. Coba lagi.";
  }
}

export function WhatsAppBotConnectionForm({
  domain,
  openWaConfigured,
  connection,
}: {
  domain: string;
  openWaConfigured: boolean;
  connection: WhatsAppBotConnectionView | null;
}) {
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const [connectState, connectAction, connectPending] = useActionState<
    { ok: boolean; code?: string },
    FormData
  >(() => connectWhatsAppBotAction(domain), { ok: true });

  const [disconnectState, disconnectAction, disconnectPending] = useActionState<
    { ok: boolean; code?: string },
    FormData
  >(() => disconnectWhatsAppBotAction(domain), { ok: true });

  if (!connection) {
    return (
      <div className="space-y-4">
        {!openWaConfigured ? (
          <p className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
            WhatsApp Bot belum bisa dihubungkan karena Provider belum mengisi kredensial OpenWA
            untuk sekolah ini. Hubungi tim SIMAS untuk mempersiapkan session WhatsApp sekolah.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Session WhatsApp untuk nomor sekolah ini sudah disiapkan Provider. Klik tombol di
            bawah untuk mengaktifkan penerimaan pesan masuk.
          </p>
        )}
        {connectState.ok === false ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {connectErrorText(connectState.code ?? "error")}
          </p>
        ) : null}
        <form action={connectAction}>
          <Button type="submit" disabled={connectPending || !openWaConfigured}>
            {connectPending ? <Spinner aria-hidden="true" /> : <Link2 aria-hidden="true" />}
            {connectPending ? "Menghubungkan…" : "Hubungkan WhatsApp"}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div className="space-y-0.5">
          <dt className="text-muted-foreground">Nomor bot</dt>
          <dd className="font-medium">{connection.botPhone ?? connection.botPushName ?? "—"}</dd>
        </div>
        <div className="space-y-0.5">
          <dt className="text-muted-foreground">Nama sesi</dt>
          <dd className="font-medium">{connection.openwaSessionName ?? "—"}</dd>
        </div>
        <div className="space-y-0.5">
          <dt className="text-muted-foreground">Session ID</dt>
          <dd className="font-mono text-xs">{connection.openwaSessionId ?? "—"}</dd>
        </div>
        <div className="space-y-0.5">
          <dt className="text-muted-foreground">Status</dt>
          <dd className="font-medium">
            {connection.status === "connected" ? "Aktif — webhook terdaftar" : "Bermasalah"}
          </dd>
        </div>
      </dl>

      {disconnectState.ok === false ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {disconnectErrorText(disconnectState.code ?? "error")}
        </p>
      ) : null}

      {confirmDisconnect ? (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <p className="text-destructive">
            Memutuskan koneksi berhenti menerima pesan masuk. Lanjutkan?
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="destructive"
              disabled={disconnectPending}
              onClick={() =>
                startTransition(() => disconnectAction(new FormData()))
              }
            >
              {disconnectPending ? <Spinner aria-hidden="true" /> : <Unlink aria-hidden="true" />}
              Putuskan
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={disconnectPending}
              onClick={() => setConfirmDisconnect(false)}
            >
              Batal
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" onClick={() => setConfirmDisconnect(true)}>
          <Unlink aria-hidden="true" />
          Putuskan Koneksi
        </Button>
      )}
    </div>
  );
}