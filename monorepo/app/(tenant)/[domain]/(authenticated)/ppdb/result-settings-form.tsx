import { updateResultSettingsAction, publishResultsAction } from "@/app/(tenant)/[domain]/(authenticated)/ppdb/actions"
import { PpdbResultCheckAccessToggle } from "@/app/(tenant)/[domain]/(authenticated)/ppdb/result-check-access-toggle"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { PpdbSession } from "@/lib/ppdb-session"

export function PpdbResultSettingsForm({
  domain,
  session,
  writable,
}: {
  domain: string
  session: PpdbSession
  writable: boolean
}) {
  const published = session.resultsPublishedAt !== null
  const ended = session.status === "ended"

  return (
    <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm" aria-labelledby="result-settings-title">
      <div>
        <h2 id="result-settings-title" className="text-lg font-bold">Pesan Hasil PPDB</h2>
        <p className="mt-1 text-sm text-slate-600">
          Hasil tetap privat dan calon siswa akan melihat status masih ditinjau sampai hasil dipublikasikan.
          Publikasi hanya tersedia untuk sesi yang sudah diakhiri.
        </p>
      </div>

      <p role="status" className={`rounded-lg border p-3 text-sm ${published ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
        {published
          ? `Hasil dipublikasikan pada ${session.resultsPublishedAt?.toLocaleString("id-ID")}.`
          : ended
            ? "Hasil belum dipublikasikan. Simpan pesan, lalu publikasikan saat seluruh keputusan sudah final."
            : "Hasil belum dipublikasikan. Akhiri sesi terlebih dahulu sebelum mempublikasikan hasil."}
      </p>

      <form action={updateResultSettingsAction.bind(null, domain)} className="grid gap-5 md:grid-cols-2">
        <input type="hidden" name="sessionId" value={session.id} />
        <ResultTextarea
          id="acceptedFeedback"
          label="Umpan balik untuk peserta diterima"
          defaultValue={session.resultSettings.acceptedFeedback}
          required
          disabled={!writable || published}
        />
        <ResultTextarea
          id="acceptedNextSteps"
          label="Langkah selanjutnya untuk peserta diterima"
          defaultValue={session.resultSettings.acceptedNextSteps}
          disabled={!writable || published}
        />
        <ResultTextarea
          id="rejectedFeedback"
          label="Umpan balik untuk peserta tidak diterima"
          defaultValue={session.resultSettings.rejectedFeedback}
          required
          disabled={!writable || published}
        />
        <ResultTextarea
          id="rejectedNextSteps"
          label="Langkah selanjutnya untuk peserta tidak diterima"
          defaultValue={session.resultSettings.rejectedNextSteps}
          disabled={!writable || published}
        />
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="whatsappGroupUrl">Tautan grup WhatsApp peserta diterima (opsional)</Label>
          <Input
            id="whatsappGroupUrl"
            name="whatsappGroupUrl"
            type="url"
            inputMode="url"
            placeholder="https://chat.whatsapp.com/..."
            defaultValue={session.resultSettings.whatsappGroupUrl ?? ""}
            disabled={!writable || published}
          />
          <p className="text-xs text-slate-500">Tautan hanya ditampilkan kepada peserta yang diterima setelah hasil dipublikasikan.</p>
        </div>
        <Button type="submit" disabled={!writable || published} className="md:col-span-2 md:justify-self-start">
          Simpan Pengaturan Hasil
        </Button>
      </form>

      <div className="border-t border-slate-200 pt-5">
        <form action={publishResultsAction.bind(null, domain)}>
          <input type="hidden" name="sessionId" value={session.id} />
          <Button type="submit" disabled={!writable || !ended || published} variant="destructive">
            {published ? "Hasil Sudah Dipublikasikan" : "Publikasikan Hasil"}
          </Button>
        </form>
        {!writable ? <p className="mt-2 text-sm text-slate-500">Tenant sedang hanya-baca; pengaturan dan publikasi hasil dinonaktifkan.</p> : null}
      </div>

      <div className="border-t border-slate-200 pt-5">
        <PpdbResultCheckAccessToggle
          domain={domain}
          sessionId={session.id}
          open={published && session.resultCheckClosedAt === null}
          disabled={!writable || !published}
        />
        {!published ? <p className="mt-2 text-sm text-slate-500">Akses cek status dapat diatur setelah hasil dipublikasikan.</p> : null}
      </div>
    </section>
  )
}

function ResultTextarea({ id, label, defaultValue, required = false, disabled = false }: { id: string; label: string; defaultValue: string; required?: boolean; disabled?: boolean }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Textarea id={id} name={id} required={required} disabled={disabled} maxLength={2000} defaultValue={defaultValue} className="min-h-32" />
    </div>
  )
}
