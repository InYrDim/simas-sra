"use client";

import { startTransition, useActionState, useState } from "react";
import { KeyRound, Save, Trash2 } from "lucide-react";

import {
  removeTenantOpenWaCredentialAction,
  saveTenantOpenWaCredentialAction,
  type OpenWaCredentialState,
} from "@/app/(provider)/provider/features/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

const initialState: OpenWaCredentialState = { status: "idle" };

export function OpenWaCredentialForm({
  tenantId,
  configured,
  sessionKey,
  overrideBaseUrl,
}: {
  tenantId: string;
  configured: boolean;
  sessionKey: string | null;
  overrideBaseUrl: string | null;
}) {
  const [confirmRemove, setConfirmRemove] = useState(false);
  const saveAction = saveTenantOpenWaCredentialAction.bind(null, tenantId);
  const removeAction = removeTenantOpenWaCredentialAction.bind(null, tenantId);
  const [saveState, saveFormAction, savePending] = useActionState<OpenWaCredentialState, FormData>(saveAction, initialState);
  const [removeState, removeFormAction, removePending] = useActionState<OpenWaCredentialState, FormData>(removeAction, initialState);

  const saved = saveState.status === "saved" || removeState.status === "removed";
  const failed = saveState.status === "error" || removeState.status === "error";

  return (
    <div className="space-y-4">
      {configured ? (
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="space-y-0.5">
            <dt className="text-muted-foreground">Session WhatsApp</dt>
            <dd className="font-mono text-xs">{sessionKey ?? "—"}</dd>
          </div>
          <div className="space-y-0.5">
            <dt className="text-muted-foreground">Server OpenWA</dt>
            <dd className="font-medium">{overrideBaseUrl ? overrideBaseUrl : "Default global Provider"}</dd>
          </div>
        </dl>
      ) : (
        <p className="text-sm text-muted-foreground">
          Tenant belum menghubungkan WhatsApp. Isi kredensial OpenWA di bawah agar sekolah bisa
          mengaktifkan penerimaan pesan masuk sendiri.
        </p>
      )}

      {saved ? (
        <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm" role="status">
          Perubahan tersimpan.
        </p>
      ) : failed ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive" role="alert">
          Perubahan gagal disimpan. Periksa kembali isian lalu coba lagi.
        </p>
      ) : null}

      <form key={configured ? "configured" : "empty"} action={saveFormAction} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="sessionKey">Nama session WhatsApp di OpenWA</Label>
          <Input
            id="sessionKey"
            name="sessionKey"
            required
            defaultValue={sessionKey ?? ""}
            placeholder="contoh: sdn-191-wa"
            className="max-w-md"
          />
          <p className="text-sm text-muted-foreground">
            Session yang sudah dibuat via Dashboard OpenWA dan siap (status Ready) oleh Provider untuk
            nomor sekolah ini.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="apiKey">API key OpenWA</Label>
          <Input
            id="apiKey"
            name="apiKey"
            type="password"
            required
            autoComplete="new-password"
            placeholder={configured ? "•••••••••••• (masukkan ulang untuk menyimpan)" : "API key akun OpenWA Provider"}
            className="max-w-md"
          />
          <p className="text-sm text-muted-foreground">
            Disimpan terenkripsi (AES-256-GCM) dan hanya dipakai untuk memanggil server OpenWA session ini.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="apiBaseUrl">Server OpenWA (opsional)</Label>
          <Input
            id="apiBaseUrl"
            name="apiBaseUrl"
            defaultValue={overrideBaseUrl ?? ""}
            placeholder="Kosongkan untuk memakai base URL default Provider (OPENWA_API_BASE_URL)"
            className="max-w-md"
          />
          <p className="text-sm text-muted-foreground">
            Isi hanya kalau server OpenWA sekolah ini berbeda dari default Provider.
          </p>
        </div>
        <Button type="submit" disabled={savePending || removePending}>
          {savePending ? <Spinner aria-hidden="true" /> : <Save aria-hidden="true" />}
          {savePending ? "Menyimpan…" : "Simpan kredensial"}
        </Button>
      </form>

      {configured ? (
        <div className="border-t pt-3">
          {confirmRemove ? (
            <div className="flex flex-wrap items-center gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
              <p className="text-destructive">
                Menghapus kredensial membuat tombol Hubungkan di pihak sekolah nonaktif sampai diisi ulang.
                Lanjutkan?
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={removePending || savePending}
                  onClick={() => startTransition(() => removeFormAction(new FormData()))}
                >
                  {removePending ? <Spinner aria-hidden="true" /> : <Trash2 aria-hidden="true" />}
                  Hapus
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={removePending}
                  onClick={() => setConfirmRemove(false)}
                >
                  Batal
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setConfirmRemove(true)} disabled={savePending || removePending}>
              <KeyRound aria-hidden="true" />
              Hapus Kredensial
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}