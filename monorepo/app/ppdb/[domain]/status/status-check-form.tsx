"use client"

import { useActionState } from "react"
import { CheckCircle, Clock, Printer, XCircle } from "lucide-react"

import { checkPpdbStatusAction, type PpdbStatusActionState } from "@/app/ppdb/[domain]/status/actions"
import { printPpdbResult } from "@/app/ppdb/[domain]/status/ppdb-result-printer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { PpdbSubmissionStatus } from "@/lib/ppdb-submission"

const initialState: PpdbStatusActionState = { status: "idle" }

const statusBadge: Record<PpdbSubmissionStatus, React.ReactNode> = {
  accepted: (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
      <CheckCircle className="size-3.5" aria-hidden="true" /> Diterima
    </span>
  ),
  rejected: (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
      <XCircle className="size-3.5" aria-hidden="true" /> Tidak diterima
    </span>
  ),
  pending: (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
      <Clock className="size-3.5" aria-hidden="true" /> Masih ditinjau
    </span>
  ),
}

function safeWhatsappUrl(value: string | null) {
  if (!value) return null
  try {
    const url = new URL(value)
    return url.protocol === "https:" && url.hostname === "chat.whatsapp.com" ? url.toString() : null
  } catch {
    return null
  }
}

export function PpdbStatusCheckForm({ domain, sessionId, nisnRequired }: { domain: string; sessionId: string; nisnRequired: boolean }) {
  const [state, formAction, pending] = useActionState(checkPpdbStatusAction.bind(null, domain, sessionId), initialState)

  return (
    <div className="min-h-svh bg-slate-100 flex justify-center pb-20">
      <main className="w-full max-w-md bg-white shadow-xl min-h-dvh flex flex-col">
        <header className="px-5 py-4 border-b border-slate-100">
          <h1 className="font-bold text-slate-900">Cek Status Pendaftaran</h1>
          <p className="text-xs text-slate-500">
            {nisnRequired ? "Masukkan Kode Pendaftaran dan NISN Anda" : "Masukkan Kode Pendaftaran Anda"}
          </p>
        </header>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <form action={formAction} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="registrationCode">Kode Pendaftaran</Label>
              <Input id="registrationCode" name="registrationCode" required placeholder="PPDB-2026-AB12CD" className="uppercase" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="nisn">NISN{nisnRequired ? "" : " (opsional)"}</Label>
              <Input
                id="nisn"
                inputMode="numeric"
                pattern="[0-9]*"
                name="nisn"
                required={nisnRequired}
                placeholder={nisnRequired ? "10 digit angka" : "Isi jika digunakan saat mendaftar"}
              />
            </div>
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? "Memeriksa..." : "Cek Status"}
            </Button>
          </form>

          {state.status === "not-found" ? (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600" role="alert">
              {nisnRequired
                ? "Data tidak ditemukan, periksa kembali Kode Pendaftaran dan NISN Anda."
                : "Data tidak ditemukan, periksa kembali Kode Pendaftaran Anda."}
            </p>
          ) : null}

          {state.status === "found" ? (
            <div className="rounded-xl border border-slate-200 p-4 space-y-3" role="status" aria-live="polite">
              <dl className="grid gap-3">
                <div>
                  <dt className="text-xs text-slate-500">Kode Pendaftaran</dt>
                  <dd className="font-mono font-semibold text-slate-900">{state.registrationCode}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Nama Peserta</dt>
                  <dd className="font-semibold text-slate-900">{state.studentName}</dd>
                </div>
              </dl>
              <PublishedResult state={state} domain={domain} sessionId={sessionId} />
            </div>
          ) : null}
        </div>
      </main>
    </div>
  )
}

type PublishedState = Extract<PpdbStatusActionState, { status: "found"; publicationStatus: "published" }>

function PublishedResult({ state, domain, sessionId }: { state: PublishedState; domain: string; sessionId: string }) {
  const whatsappUrl = state.submissionStatus === "accepted" ? safeWhatsappUrl(state.whatsappGroupUrl) : null

  return (
    <div className="space-y-3">
      <div>{statusBadge[state.submissionStatus]}</div>
      {state.submissionStatus !== "pending" && state.score !== null ? (
        <p className="text-sm text-slate-500">Skor: <span className="font-semibold text-slate-700">{state.score}</span></p>
      ) : null}
      {state.feedback ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Umpan balik</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{state.feedback}</p>
        </div>
      ) : null}
      {state.nextSteps ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Langkah selanjutnya</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{state.nextSteps}</p>
        </div>
      ) : null}
      <Button type="button" variant="outline" onClick={() => printPpdbResult({ state, domain, sessionId, whatsappUrl })} className="w-full">
        <Printer aria-hidden="true" /> Cetak / Simpan PDF A4
      </Button>
      {whatsappUrl ? (
        <Button nativeButton={false} render={<a href={whatsappUrl} target="_blank" rel="noopener noreferrer" />} className="w-full">
          Buka Grup WhatsApp
        </Button>
      ) : null}
    </div>
  )
}
