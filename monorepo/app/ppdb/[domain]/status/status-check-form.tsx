"use client"

import { useActionState } from "react"
import { CheckCircle, Clock, XCircle } from "lucide-react"

import { checkPpdbStatusAction, type PpdbStatusActionState } from "@/app/ppdb/[domain]/status/actions"
import type { PpdbSubmissionStatus } from "@/lib/ppdb-submission"

const fieldClassName =
  "mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none"

const initialState: PpdbStatusActionState = { status: "idle" }

// Badge status ini meniru className persis dari app/(tenant)/[domain]/(authenticated)/ppdb/page.tsx supaya konsisten.
const statusBadge: Record<PpdbSubmissionStatus, React.ReactNode> = {
  accepted: (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
      <CheckCircle className="size-3.5" /> Diterima
    </span>
  ),
  rejected: (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
      <XCircle className="size-3.5" /> Ditolak
    </span>
  ),
  pending: (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
      <Clock className="size-3.5" /> Menunggu
    </span>
  ),
}

export function PpdbStatusCheckForm({ domain, nisnRequired }: { domain: string; nisnRequired: boolean }) {
  const [state, formAction, pending] = useActionState(checkPpdbStatusAction.bind(null, domain), initialState)

  return (
    <div className="min-h-svh bg-slate-100 flex justify-center pb-20">
      <main className="w-full max-w-md bg-white shadow-xl min-h-[100dvh] flex flex-col">
        <header className="px-5 py-4 border-b border-slate-100">
          <h1 className="font-bold text-slate-900">Cek Status Pendaftaran</h1>
          <p className="text-xs text-slate-500">
            {nisnRequired ? "Masukkan Kode Pendaftaran dan NISN Anda" : "Masukkan Kode Pendaftaran Anda"}
          </p>
        </header>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <form action={formAction} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700">Kode Pendaftaran</label>
              <input
                type="text"
                name="registrationCode"
                required
                placeholder="PPDB-2026-AB12CD"
                className={`${fieldClassName} uppercase`}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">
                NISN{nisnRequired ? "" : " (opsional)"}
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                name="nisn"
                required={nisnRequired}
                placeholder={nisnRequired ? "10 digit angka" : "Isi jika digunakan saat mendaftar"}
                className={fieldClassName}
              />
            </div>
            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-xl bg-sky-500 py-3 text-sm font-bold text-white shadow-lg shadow-sky-500/20 hover:bg-sky-600 transition-colors disabled:opacity-50"
            >
              {pending ? "Memeriksa..." : "Cek Status"}
            </button>
          </form>

          {state.status === "not-found" ? (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600" role="alert">
              {nisnRequired
                ? "Data tidak ditemukan, periksa kembali Kode Pendaftaran dan NISN Anda."
                : "Data tidak ditemukan, periksa kembali Kode Pendaftaran Anda."}
            </p>
          ) : null}

          {state.status === "found" ? (
            <div className="rounded-xl border border-slate-200 p-4 space-y-2" role="status">
              <p className="text-xs text-slate-500">Nama Peserta</p>
              <p className="font-semibold text-slate-900">{state.studentName}</p>
              <div className="pt-1">{statusBadge[state.submissionStatus]}</div>
              {state.submissionStatus !== "pending" && state.score !== null ? (
                <p className="pt-1 text-sm text-slate-500">
                  Skor: <span className="font-semibold text-slate-700">{state.score}</span>
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </main>
    </div>
  )
}
