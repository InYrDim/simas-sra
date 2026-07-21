"use client"

import Link from "next/link"
import { startTransition, useActionState, useRef, useState } from "react"
import { CheckCircle2, ChevronRight, UploadCloud } from "lucide-react"
import { toast } from "sonner"

import { submitPpdbApplicationAction, type PpdbApplicationActionState } from "@/app/apply/[domain]/actions"
import { PpdbSessionClosedNotice } from "@/app/apply/[domain]/session-closed-notice"
import { PPDB_FILE_MAX_MB, validatePpdbFileSize } from "@/lib/ppdb-file-validation"
import { buildPpdbFormSteps } from "@/lib/ppdb-form-steps"
import type { PpdbFormField } from "@/lib/ppdb-session"

const fieldClassName =
  "mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none"

const initialState: PpdbApplicationActionState = { status: "idle" }

export function PpdbApplyForm({
  domain,
  fields,
  nisnRequired,
}: {
  domain: string
  fields: readonly PpdbFormField[]
  nisnRequired: boolean
}) {
  const steps = buildPpdbFormSteps(fields)
  const totalSteps = steps.length
  const [step, setStep] = useState(0)
  const [fileNames, setFileNames] = useState<Record<string, string>>({})
  const formRef = useRef<HTMLFormElement>(null)
  const stepRefs = useRef<Array<HTMLDivElement | null>>([])
  const [state, formAction, pending] = useActionState(submitPpdbApplicationAction.bind(null, domain), initialState)

  if (!fields.length || state.status === "closed") return <PpdbSessionClosedNotice />
  if (state.status === "success") return <PpdbApplySuccess domain={domain} registrationCode={state.registrationCode} />

  function goNext() {
    const container = stepRefs.current[step]
    const invalid = container?.querySelector<HTMLInputElement | HTMLSelectElement>(":invalid")
    if (invalid) {
      invalid.reportValidity()
      return
    }
    setStep((current) => Math.min(current + 1, totalSteps - 1))
  }

  function goBack() {
    setStep((current) => Math.max(current - 1, 0))
  }

  return (
    <div className="min-h-svh bg-slate-100 flex justify-center">
      <main className="w-full bg-white shadow-xl min-h-[100dvh] relative overflow-hidden flex flex-col">
        <header className="px-5 py-4 border-b border-slate-100">
          <h1 className="font-bold text-slate-900">Pendaftaran PPDB</h1>
          <p className="text-xs text-slate-500">Domain: {domain}</p>

          <div className="mt-4">
            <div className="flex justify-between text-xs font-semibold text-slate-400 mb-1">
              <span>Langkah {step + 1} dari {totalSteps}</span>
              <span>{Math.round(((step + 1) / totalSteps) * 100)}%</span>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-sky-500 transition-all duration-300"
                style={{ width: `${((step + 1) / totalSteps) * 100}%` }}
              />
            </div>
          </div>
        </header>

        <form
          ref={formRef}
          className="flex-1 flex flex-col"
          onSubmit={(event) => {
            event.preventDefault()
            if (step < totalSteps - 1) goNext()
          }}
        >
          <div className="flex-1 overflow-y-auto p-5 pb-24">
            {state.status === "error" ? (
              <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600" role="alert">{state.message}</p>
            ) : null}

            {steps.map((definition, index) => (
              <div
                key={index}
                ref={(element) => {
                  stepRefs.current[index] = element
                }}
                className={index === step ? "space-y-4 animate-in slide-in-from-right-4 fade-in duration-300" : "hidden"}
              >
                {definition.kind === "fields" ? (
                  <>
                    <h2 className="text-lg font-bold mb-4">{definition.title}</h2>
                    {definition.fields.map((field) => (
                      <DynamicField key={field.id} field={field} nisnRequired={nisnRequired} />
                    ))}
                  </>
                ) : definition.kind === "files" ? (
                  <>
                    <h2 className="text-lg font-bold mb-4">{definition.title}</h2>
                    {definition.fields.map((field) => (
                      <FileField
                        key={field.id}
                        field={field}
                        selectedName={fileNames[field.id]}
                        onSelect={(name) => setFileNames((current) => ({ ...current, [field.id]: name }))}
                      />
                    ))}
                  </>
                ) : (
                  <div className="rounded-xl border border-sky-200 bg-sky-50 p-5 text-center">
                    <h2 className="text-lg font-bold text-slate-900">{definition.title}</h2>
                    <p className="mt-2 text-sm text-slate-600">
                      Periksa kembali isian Anda dengan tombol Kembali. Tekan Kirim Pendaftaran hanya jika seluruh data sudah benar.
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>

          <footer className="absolute bottom-0 w-full border-t border-slate-100 bg-white p-4 flex gap-3">
            {step > 0 && (
              <button
                type="button"
                onClick={goBack}
                disabled={pending}
                className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-bold text-slate-700 disabled:opacity-50"
              >
                Kembali
              </button>
            )}
            {step < totalSteps - 1 ? (
              <button
                type="button"
                onClick={goNext}
                disabled={pending}
                className="flex-[2] rounded-xl bg-sky-500 py-3 text-sm font-bold text-white shadow-lg shadow-sky-500/20 flex justify-center items-center gap-2 hover:bg-sky-600 transition-colors disabled:opacity-50"
              >
                Selanjutnya
                <ChevronRight className="size-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (!formRef.current) return
                  const formData = new FormData(formRef.current)
                  startTransition(() => formAction(formData))
                }}
                className="flex-[2] rounded-xl bg-sky-500 py-3 text-sm font-bold text-white shadow-lg shadow-sky-500/20 flex justify-center items-center gap-2 hover:bg-sky-600 transition-colors disabled:opacity-50"
              >
                {pending ? "Mengirim..." : "Kirim Pendaftaran"}
              </button>
            )}
          </footer>
        </form>
      </main>
    </div>
  )
}

function DynamicField({ field, nisnRequired }: { field: PpdbFormField; nisnRequired: boolean }) {
  return (
    <div>
      <label className="text-sm font-medium text-slate-700">
        {field.label}
        {field.required || (field.purpose === "nisn" && nisnRequired) ? " *" : ""}
      </label>
      {field.type === "select" ? (
        <select name={field.id} required={field.required || (field.purpose === "nisn" && nisnRequired)} defaultValue="" className={`${fieldClassName} bg-white`}>
          <option value="" disabled>Pilih {field.label}</option>
          {(field.options ?? []).map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      ) : (
        <input
          type={field.type === "number" ? "number" : "text"}
          name={field.id}
          required={field.required || (field.purpose === "nisn" && nisnRequired)}
          className={fieldClassName}
        />
      )}
    </div>
  )
}

function FileField({
  field,
  selectedName,
  onSelect,
}: {
  field: PpdbFormField
  selectedName?: string
  onSelect: (name: string) => void
}) {
  return (
    <div className="rounded-xl border-2 border-dashed border-slate-200 hover:border-sky-300 transition-colors p-6 text-center">
      <UploadCloud className="size-8 text-sky-500 mx-auto mb-2" />
      <p className="text-sm font-medium">
        {field.label}
        {field.required ? " *" : ""}
      </p>
      <p className="text-xs text-slate-500 mt-1">{selectedName ? `Dipilih: ${selectedName}` : `Format PDF/JPG maks. ${PPDB_FILE_MAX_MB} MB`}</p>
      <label className="mt-3 inline-block bg-sky-50 text-sky-600 px-4 py-1.5 rounded-full text-xs font-semibold cursor-pointer">
        Pilih File
        <input
          type="file"
          name={field.id}
          required={field.required}
          accept="application/pdf,image/jpeg,image/png"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (!file) {
              onSelect("")
              return
            }

            const error = validatePpdbFileSize(file.size)
            if (error) {
              event.target.value = ""
              onSelect("")
              toast.error(error)
              return
            }

            onSelect(file.name)
          }}
        />
      </label>
    </div>
  )
}

function PpdbApplySuccess({ domain, registrationCode }: { domain: string; registrationCode: string }) {
  return (
    <div className="min-h-svh bg-slate-100 flex justify-center pb-20">
      <main className="w-full max-w-md bg-white shadow-xl min-h-[100dvh] flex flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="rounded-full bg-emerald-100 p-4">
          <CheckCircle2 className="size-8 text-emerald-600" />
        </div>
        <h1 className="text-lg font-bold text-slate-900">Pendaftaran berhasil dikirim!</h1>
        <p className="text-sm text-slate-500">
          Simpan Kode Pendaftaran di bawah ini baik-baik — kode ini adalah satu-satunya cara untuk memeriksa status pendaftaran Anda nanti.
        </p>
        <div className="w-full rounded-xl border-2 border-dashed border-sky-300 bg-sky-50 p-4">
          <p className="text-xs font-semibold text-sky-600 uppercase">Kode Pendaftaran</p>
          <p className="mt-1 text-2xl font-bold tracking-wide text-sky-700">{registrationCode}</p>
        </div>
        <Link
          href={`/apply/${domain}/status`}
          className="mt-2 w-full rounded-xl bg-sky-500 py-3 text-sm font-bold text-white shadow-lg shadow-sky-500/20 flex justify-center items-center gap-2 hover:bg-sky-600 transition-colors"
        >
          Cek Status Pendaftaran
        </Link>
      </main>
    </div>
  )
}
