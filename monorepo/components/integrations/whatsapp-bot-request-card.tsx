"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { CheckCircle2, ClipboardList, Phone, Plus, QrCode, RefreshCw, Send, Smartphone, Sparkles } from "lucide-react";

import {
  completeWhatsAppBotSelfServiceAction,
  readWhatsAppBotSelfServiceStatusAction,
  readWhatsAppBotSessionStatusAction,
  refreshWhatsAppBotSelfServiceQrAction,
  startWhatsAppBotSelfServiceAction,
  submitWhatsAppBotRequestAction,
} from "@/app/(tenant)/[domain]/(authenticated)/integrasi/whatsapp/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

export type WhatsAppBotRequestView = {
  id: string;
  requestedPhone: string;
  desiredSessionName: string | null;
  picName: string;
  note: string | null;
  status: "pending" | "approved" | "rejected" | "fulfilled";
  providerNote: string | null;
  openwaSessionId: string | null;
  resolvedAt: string | null;
  createdAt: string;
};

const timeFormat = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" });

function submitErrorText(code: string): string {
  switch (code) {
    case "phone-invalid":
      return "Nomor WhatsApp tidak valid. Gunakan awalan 0, 8, atau 62 dengan 9–15 digit.";
    case "pic-required":
      return "Nama PIC wajib diisi.";
    case "session-name-invalid":
      return "Nama sesi hanya boleh huruf, angka, dan tanda hubung (3–50 karakter).";
    case "note-too-long":
      return "Keterangan maksimal 1000 karakter.";
    case "connection-exists":
      return "WhatsApp Bot sekolah sudah terhubung, tidak perlu mengajukan lagi.";
    case "request-pending":
      return "Masih ada pengajuan yang sedang diproses. Tunggu keputusan Provider.";
    default:
      return "Terjadi kesalahan saat mengirim pengajuan. Coba lagi.";
  }
}

function startErrorText(code: string): string {
  switch (code) {
    case "not-approved":
      return "Pengajuan belum disetujui Provider.";
    case "provisioning-disabled":
      return "Penyiapan mandiri belum tersedia. Hubungi tim SIMAS untuk menyiapkan session.";
    case "session-name-taken":
      return "Nama sesi yang diusulkan sudah terpakai semua. Ajukan nama sesi lain.";
    case "admin-key-invalid":
      return "Kredensial admin OpenWA tidak valid. Hubungi tim SIMAS.";
    case "openwa-unreachable":
      return "Server OpenWA tidak dapat dijangkau. Coba lagi nanti.";
    case "openwa-error":
      return "Gagal menyiapkan session di server OpenWA. Coba lagi.";
    default:
      return "Terjadi kesalahan saat menyiapkan session. Coba lagi.";
  }
}

function qrErrorText(code: string): string {
  switch (code) {
    case "not-started":
      return "Session belum disiapkan. Klik tombol Mulai Penyiapan terlebih dahulu.";
    case "provisioning-disabled":
      return "Penyiapan mandiri belum tersedia. Hubungi tim SIMAS.";
    case "admin-key-invalid":
      return "Kredensial admin OpenWA tidak valid. Hubungi tim SIMAS.";
    case "openwa-unreachable":
      return "Server OpenWA tidak dapat dijangkau. Coba lagi nanti.";
    case "qr-unavailable":
      return "QR belum tersedia. Tunggu beberapa saat lalu muat ulang.";
    case "already-connected":
      return "Session WhatsApp sudah terkoneksi. Tidak perlu memindai QR lagi.";
    case "session-gone":
      return "Session WhatsApp tidak ditemukan di server OpenWA. Siapkan ulang session.";
    case "openwa-error":
      return "Gagal memuat QR dari server OpenWA. Coba lagi.";
    default:
      return "Terjadi kesalahan saat memuat QR. Coba lagi.";
  }
}

function completeErrorText(code: string): string {
  switch (code) {
    case "not-started":
      return "Session belum disiapkan. Mulai penyiapan terlebih dahulu.";
    case "session-not-ready":
      return "WhatsApp di nomor tersebut belum menampilkan status terhubung. Pastikan QR sudah dipindai dengan WhatsApp, lalu coba lagi.";
    case "session-gone":
      return "Session WhatsApp tidak ditemukan di server OpenWA. Siapkan ulang session.";
    case "unconfigured":
      return "Kredensial belum tersedia. Hubungi tim SIMAS.";
    case "connect-failed":
      return "Gagal mendaftarkan koneksi akhir. Coba lagi.";
    default:
      return "Terjadi kesalahan saat menyelesaikan koneksi. Coba lagi.";
  }
}

function statusLabel(status: WhatsAppBotRequestView["status"]): string {
  switch (status) {
    case "pending":
      return "Menunggu Persetujuan";
    case "approved":
      return "Disetujui";
    case "rejected":
      return "Ditolak";
    case "fulfilled":
      return "Selesai";
  }
}

function sessionStatusBadge(
  status: string | null,
  connected: boolean,
): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } {
  if (status == null) return { label: "Belum disiapkan", variant: "outline" };
  if (connected) return { label: "Terhubung", variant: "default" };
  switch (status) {
    case "qr_ready":
      return { label: "Menunggu Pemindaian QR", variant: "secondary" };
    case "initializing":
    case "pending":
      return { label: "Menyiapkan…", variant: "secondary" };
    case "disconnected":
    case "stopped":
    case "failed":
    case "error":
      return { label: "Terputus", variant: "destructive" };
    default:
      return { label: status, variant: "secondary" };
  }
}

function WhatsAppSessionStatusBadge({ domain }: { domain: string }) {
  const [status, setStatus] = useState<{ status: string | null; connected: boolean } | null>(null);

  useEffect(() => {
    let alive = true;
    let interval: ReturnType<typeof setInterval> | null = null;
    const check = async () => {
      const result = await readWhatsAppBotSessionStatusAction(domain).catch(() => null);
      if (!alive || !result?.ok) return;
      setStatus({ status: result.status, connected: result.connected });
    };
    void check();
    interval = setInterval(() => void check(), 5000);
    return () => {
      alive = false;
      if (interval) clearInterval(interval);
    };
  }, [domain]);

  const meta = status ? sessionStatusBadge(status.status, status.connected) : null;
  return (
    <Badge variant={meta?.variant ?? "outline"} className="w-fit capitalize">
      {meta?.label ?? "Memuat status…"}
    </Badge>
  );
}

function WhatsAppBotRequestForm({ domain, submitLabel }: { domain: string; submitLabel: string }) {
  const [state, action, pending] = useActionState<
    Awaited<ReturnType<typeof submitWhatsAppBotRequestAction>> | null,
    FormData
  >(
    async (_previous, formData) =>
      submitWhatsAppBotRequestAction(domain, {
        requestedPhone: String(formData.get("requestedPhone") ?? ""),
        picName: String(formData.get("picName") ?? ""),
        desiredSessionName: String(formData.get("desiredSessionName") ?? "").trim() || null,
        note: String(formData.get("note") ?? "").trim() || null,
      }),
    null,
  );

  const submitSucceeded = state !== null && state.ok;

  return (
    <form className="grid gap-4" action={action}>
      <div className="grid gap-1.5">
        <Label htmlFor="requestedPhone">Nomor WhatsApp Bot</Label>
        <Input
          id="requestedPhone"
          name="requestedPhone"
          placeholder="contoh: 081234567890"
          required
          autoComplete="off"
          inputMode="tel"
        />
        <p className="text-xs text-muted-foreground">
          Nomor yang akan dipakai sebagai bot (bukan nomor PIC).
        </p>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="picName">Nama PIC</Label>
        <Input id="picName" name="picName" placeholder="Nama penanggung jawab" required />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="desiredSessionName">Usulan Nama Sesi (opsional)</Label>
        <Input
          id="desiredSessionName"
          name="desiredSessionName"
          placeholder="contoh: sdn1-wa"
          autoComplete="off"
        />
        <p className="text-xs text-muted-foreground">
          Huruf, angka, dan tanda hubung, 3–50 karakter.
        </p>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="note">Keperluan / Catatan (opsional)</Label>
        <Textarea id="note" name="note" placeholder="jelaskan keperluan penggunaan bot" rows={3} />
      </div>

      {state !== null && !state.ok ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {submitErrorText(state.code)}
        </p>
      ) : null}
      {submitSucceeded ? (
        <p className="flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-600">
          <CheckCircle2 aria-hidden="true" className="size-4" />
          Pengajuan terkirim. Tunggu persetujuan Provider.
        </p>
      ) : null}

      <DialogFooter className="sm:justify-between" showCloseButton>
        <Button type="submit" disabled={pending || submitSucceeded}>
          {pending ? <Spinner aria-hidden="true" /> : <Send aria-hidden="true" />}
          {pending ? "Mengirim…" : submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}

function SubmitRequestDialog({ domain }: { domain: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button>
            <Plus aria-hidden="true" />
            Ajukan Pengajuan WA Bot
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList aria-hidden="true" className="size-5" />
            Pengajuan WhatsApp Bot
          </DialogTitle>
          <DialogDescription>
            Ajukan nomor WhatsApp sekolah untuk disiapkan dan disetujui Provider. Setelah
            disetujui, session siap dihubungkan atau disiapkan mandiri.
          </DialogDescription>
        </DialogHeader>
        <WhatsAppBotRequestForm domain={domain} submitLabel="Kirim Pengajuan" />
      </DialogContent>
    </Dialog>
  );
}

function SelfServicePanel({
  domain,
  openwaSessionId,
}: {
  domain: string;
  openwaSessionId: string | null;
}) {
  const [qr, setQr] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [qrPending, setQrPending] = useState(false);
  const [restartRequired, setRestartRequired] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [startState, setStartState] = useState<Awaited<
    ReturnType<typeof startWhatsAppBotSelfServiceAction>
  > | null>(null);
  const [startPending, setStartPending] = useState(false);
  const [completeState, setCompleteState] = useState<Awaited<
    ReturnType<typeof completeWhatsAppBotSelfServiceAction>
  > | null>(null);
  const [completePending, setCompletePending] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const applyError = (code: string) => {
    setQrError(qrErrorText(code));
    setRestartRequired(code === "session-gone");
  };

  const checkScanner = async () => {
    const result = await readWhatsAppBotSelfServiceStatusAction(domain);
    if (!result.ok) {
      applyError(result.code);
      return;
    }
    if (result.connected) {
      setScanned(true);
      setQrError(null);
      setRestartRequired(false);
      stopPolling();
    }
  };

  const loadQr = async () => {
    setQrPending(true);
    const result = await refreshWhatsAppBotSelfServiceQrAction(domain);
    setQrPending(false);
    if (result.ok) {
      setQrError(null);
      setRestartRequired(false);
      setQr((prev) => (result.qrCode === prev ? prev : result.qrCode));
      if (result.status === "ready" || result.status === "connected" || scanned) {
        setScanned(true);
        stopPolling();
      } else {
        if (!intervalRef.current) {
          intervalRef.current = setInterval(() => {
            void checkScanner();
          }, 5000);
        }
      }
    } else if (result.code === "already-connected") {
      setScanned(true);
      setQrError(null);
      setRestartRequired(false);
      stopPolling();
    } else {
      applyError(result.code);
    }
  };

  const handleStart = async () => {
    setStartPending(true);
    const result = await startWhatsAppBotSelfServiceAction(domain);
    setStartState(result);
    setStartPending(false);
    if (result.ok) {
      setQr(null);
      setQrError(null);
      setRestartRequired(false);
      setScanned(false);
    }
  };

  const handleComplete = async () => {
    setCompletePending(true);
    const result = await completeWhatsAppBotSelfServiceAction(domain);
    setCompleteState(result);
    setCompletePending(false);
    if (result.ok) {
      setScanned(true);
      stopPolling();
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      void checkScanner();
    }, 0);
    return () => {
      clearTimeout(timer);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!openwaSessionId && startState?.ok !== true) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Penanggung jawab PIC dapat menyiapkan session WhatsApp sendiri dengan memindai QR
          menggunakan WhatsApp di nomor yang diajukan.
        </p>
        {startState?.ok === false ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {startErrorText(startState.code)}
          </p>
        ) : null}
        <Button onClick={() => void handleStart()} disabled={startPending}>
          {startPending ? <Spinner aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
          {startPending ? "Menyiapkan…" : "Mulai Penyiapan Session"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {!scanned ? (
        <div className="flex items-start gap-3 rounded-md border p-4">
          {qr ? (
          <div className="relative size-40 shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qr}
              alt="QR WhatsApp untuk memindai dari nomor bot"
              className="size-40 rounded-md object-contain"
            />
            {qrPending ? (
              <div
                aria-hidden="true"
                className="absolute inset-0 flex items-center justify-center rounded-md bg-card/80"
              >
                <Spinner className="size-6" />
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex size-40 shrink-0 items-center justify-center rounded-md bg-muted">
            {qrPending ? (
              <Spinner aria-hidden="true" className="size-10 text-muted-foreground" />
            ) : (
              <QrCode aria-hidden="true" className="size-10 text-muted-foreground" />
            )}
          </div>
        )}
        <div className="space-y-2 text-sm">
          {qrPending && !qr ? (
            <p>
              <strong>Menyiapkan QR WhatsApp…</strong>
            </p>
          ) : (
            <>
              <p>
                Pindai QR ini dengan <strong>WhatsApp &gt; Setelan &gt; Perangkat tertaut</strong> pada
                nomor yang diajukan.
              </p>
              <p className="text-muted-foreground">
                Koneksi tuntas setelah nomor menampilkan status &#8220;Terhubung&#8221;, lalu klik
                tombol &quot;Sesi Sudah Terhubung&quot;.
              </p>
            </>
          )}
          {qrError ? <p className="text-destructive">{qrError}</p> : null}
        </div>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {scanned ? (
          <Button onClick={() => void handleComplete()} disabled={completePending}>
            {completePending ? <Spinner aria-hidden="true" /> : <Smartphone aria-hidden="true" />}
            {completePending ? "Menyelesaikan…" : "Sesi Sudah Terhubung"}
          </Button>
        ) : restartRequired ? (
          <Button onClick={() => void handleStart()} disabled={startPending}>
            {startPending ? <Spinner aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
            {startPending ? "Menyiapkan…" : "Siapkan Ulang Session"}
          </Button>
        ) : !qr ? (
          <Button onClick={() => void loadQr()} disabled={qrPending}>
            {qrPending ? <Spinner aria-hidden="true" /> : <QrCode aria-hidden="true" />}
            {qrPending ? "Membuat…" : "Tampilkan QR"}
          </Button>
        ) : (
          <>
            <Button variant="outline" onClick={() => void loadQr()} disabled={qrPending || completePending}>
              {qrPending ? <Spinner aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
              {qrPending ? "Memuat…" : "Muat Ulang QR"}
            </Button>
            <Button onClick={() => void handleComplete()} disabled={completePending}>
              {completePending ? <Spinner aria-hidden="true" /> : <Smartphone aria-hidden="true" />}
              {completePending ? "Menyelesaikan…" : "Sesi Sudah Terhubung"}
            </Button>
          </>
        )}
      </div>
      {scanned ? (
        <p className="flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-600">
          <CheckCircle2 aria-hidden="true" className="size-4" />
          WhatsApp sudah terhubung di nomor tersebut. Klik &#8220;Sesi Sudah Terhubung&#8221; untuk
          menyelesaikan koneksi.
        </p>
      ) : null}
      {completeState?.ok === false ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {completeErrorText(completeState.code)}
        </p>
      ) : null}
      {completeState?.ok === true ? (
        <p className="flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-600">
          <CheckCircle2 aria-hidden="true" className="size-4" />
          Koneksi WhatsApp Bot aktif.
        </p>
      ) : null}
    </div>
  );
}

export function WhatsAppBotRequestCard({
  domain,
  request,
}: {
  domain: string;
  request: WhatsAppBotRequestView | null;
}) {
  const [open, setOpen] = useState(false);

  if (!request) return <SubmitRequestDialog domain={domain} />;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline">
            <ClipboardList aria-hidden="true" className="size-4" />
            Lihat Status Pengajuan
          </Button>
        }
      />
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone aria-hidden="true" className="size-5" />
            Status Pengajuan WA Bot
          </DialogTitle>
          <DialogDescription>
            Ajukan nomor WhatsApp sekolah (WA Bot) untuk disiapkan dan disetujui Provider sebelum
            koneksi diaktifkan.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <h3 className="flex items-center gap-2 text-sm font-medium">
              <ClipboardList aria-hidden="true" className="size-4 text-muted-foreground" />
              Status Pengajuan
            </h3>
            <Badge variant={request.status === "rejected" ? "destructive" : "secondary"}>
              {statusLabel(request.status)}
            </Badge>
          </div>
          {request.status === "approved" || request.status === "fulfilled" ? (
            <div className="space-y-1.5">
              <h3 className="flex items-center gap-2 text-sm font-medium">
                <Smartphone aria-hidden="true" className="size-4 text-muted-foreground" />
                Status Akun WhatsApp (Sesi)
              </h3>
              <WhatsAppSessionStatusBadge domain={domain} />
            </div>
          ) : null}
        </div>

        <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div className="space-y-0.5">
            <dt className="text-muted-foreground">Nomor WA Bot</dt>
            <dd className="font-mono">{request.requestedPhone}</dd>
          </div>
          <div className="space-y-0.5">
            <dt className="text-muted-foreground">PIC</dt>
            <dd className="font-medium">{request.picName}</dd>
          </div>
          {request.desiredSessionName ? (
            <div className="space-y-0.5">
              <dt className="text-muted-foreground">Usulan nama sesi</dt>
              <dd className="font-mono">{request.desiredSessionName}</dd>
            </div>
          ) : null}
          <div className="space-y-0.5">
            <dt className="text-muted-foreground">Diajukan</dt>
            <dd>{timeFormat.format(new Date(request.createdAt))}</dd>
          </div>
          {request.note ? (
            <div className="space-y-0.5 sm:col-span-2">
              <dt className="text-muted-foreground">Keperluan</dt>
              <dd className="max-w-prose whitespace-pre-wrap">{request.note}</dd>
            </div>
          ) : null}
          {request.providerNote ? (
            <div className="space-y-0.5 sm:col-span-2">
              <dt className="text-muted-foreground">Catatan Provider</dt>
              <dd className="max-w-prose whitespace-pre-wrap text-destructive">{request.providerNote}</dd>
            </div>
          ) : null}
          {request.resolvedAt ? (
            <div className="space-y-0.5">
              <dt className="text-muted-foreground">Diproses</dt>
              <dd>{timeFormat.format(new Date(request.resolvedAt))}</dd>
            </div>
          ) : null}
        </dl>

        {request.status === "approved" ? (
          <div className="mt-4 border-t border-border/70 pt-4">
            <SelfServicePanel domain={domain} openwaSessionId={request.openwaSessionId} />
          </div>
        ) : null}

        {request.status === "rejected" ? (
          <div className="mt-4 grid gap-3 border-t pt-4">
            <h3 className="flex items-center gap-2 text-sm font-medium">
              <Plus aria-hidden="true" className="size-4 text-muted-foreground" />
              Ajukan Ulang
            </h3>
            <p className="text-sm text-muted-foreground">
              Pengajuan ditolak. Silakan ajukan ulang dengan nomor yang benar.
            </p>
            <WhatsAppBotRequestForm domain={domain} submitLabel="Kirim Ulang" />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}