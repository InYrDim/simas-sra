"use client"

import Link from "next/link"
import { useActionState, useRef, useState } from "react"
import { CheckCircle2, ChevronRight, UploadCloud } from "lucide-react"
import { toast } from "sonner"

import { submitPpdbApplicationAction, type PpdbApplicationActionState } from "@/app/apply/[domain]/actions"
import { PpdbSessionClosedNotice } from "@/app/apply/[domain]/session-closed-notice"
import { PPDB_FILE_MAX_MB, validatePpdbFileSize } from "@/lib/ppdb-file-validation"
import type { PpdbFormField } from "@/lib/ppdb-session"

const FIELDS_PER_STEP = 3
const FILES_PER_STEP = 2
const fieldClassName =
  "mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 outline-none"

type StepDefinition =
  | { kind: "base" }
  | { kind: "fields"; title: string; fields: PpdbFormField[] }
  | { kind: "files"; title: string; fields: PpdbFormField[] }

function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size))
  return chunks
}

// Field dikelompokkan ke beberapa langkah supaya tetap ringkas di layar kecil: field non-berkas
// dipecah per ~3 field, dan field berkas dipisah ke langkah tersendiri (meniru "Upload Dokumen" pada mock awal).
function buildSteps(fields: readonly PpdbFormField[]): StepDefinition[] {
  const regularFields = fields.filter((field) => field.type !== "file")
  const fileFields = fields.filter((field) => field.type === "file")
  const regularChunks = chunk(regularFields, FIELDS_PER_STEP)
  const fileChunks = chunk(fileFields, FILES_PER_STEP)

  const steps: StepDefinition[] = [{ kind: "base" }]
  regularChunks.forEach((group, index) => {
    steps.push({
      kind: "fields",
      title: regularChunks.length > 1 ? `Informasi Tambahan (${index + 1}/${regularChunks.length})` : "Informasi Tambahan",
      fields: group,
    })
  })
  fileChunks.forEach((group, index) => {
    steps.push({
      kind: "files",
      title: fileChunks.length > 1 ? `Upload Dokumen (${index + 1}/${fileChunks.length})` : "Upload Dokumen",
      fields: group,
    })
  })
  return steps
}

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
  const steps = buildSteps(fields)
  const totalSteps = steps.length
  const [step, setStep] = useState(0)
  const [fileNames, setFileNames] = useState<Record<string, string>>({})
  const stepRefs = useRef<Array<HTMLDivElement | null>>([])
  const [state, formAction, pending] = useActionState(submitPpdbApplicationAction.bind(null, domain), initialState)

  if (state.status === "closed") return <PpdbSessionClosedNotice />
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
    <div className="min-h-svh bg-slate-100 flex justify-center pb-20">
      <main className="w-full max-w-md bg-white shadow-xl min-h-[100dvh] relative overflow-hidden flex flex-col">
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

        <form action={formAction} className="flex-1 flex flex-col">
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
                {definition.kind === "base" ? (
                  <>
                    <h2 className="text-lg font-bold mb-4">Informasi Pribadi</h2>
                    <div>
                      <label className="text-sm font-medium text-slate-700">Nama Lengkap</label>
                      <input type="text" name="studentName" required className={fieldClassName} placeholder="Sesuai ijazah" />
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
                        className={fieldClassName}
                        placeholder={nisnRequired ? "10 digit angka" : "Isi jika sudah memiliki NISN"}
                      />
                    </div>
                  </>
                ) : definition.kind === "fields" ? (
                  <>
                    <h2 className="text-lg font-bold mb-4">{definition.title}</h2>
                    {definition.fields.map((field) => (
                      <DynamicField key={field.id} field={field} />
                    ))}
                  </>
                ) : (
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
                type="submit"
                disabled={pending}
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

function DynamicField({ field }: { field: PpdbFormField }) {
  return (
    <div>
      <label className="text-sm font-medium text-slate-700">
        {field.label}
        {field.required ? " *" : ""}
      </label>
      {field.type === "select" ? (
        <select name={field.id} required={field.required} defaultValue="" className={`${fieldClassName} bg-white`}>
          <option value="" disabled>Pilih {field.label}</option>
          {(field.options ?? []).map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      ) : (
        <input type={field.type === "number" ? "number" : "text"} name={field.id} required={field.required} className={fieldClassName} />
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
        {/* Penyimpanan berkas sesungguhnya belum tersedia (item terbuka terpisah); untuk saat ini hanya nama berkas yang dikirim. */}
        <input type="hidden" name={field.id} value={selectedName ?? ""} />
        <input
          type="file"
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
