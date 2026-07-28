"use client"

import type { ReactNode } from "react"
import { useState } from "react"
import { useFormStatus } from "react-dom"
import { ArrowDown, ArrowUp, Copy, GripVertical, Loader2, Plus, Rocket, Save, Trash2 } from "lucide-react"

import { publishSessionAction, updateFieldsAction } from "@/app/(tenant)/[domain]/(authenticated)/ppdb/actions"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ensurePpdbSystemFields, isPpdbChoiceField, type PpdbFieldType, type PpdbFormField } from "@/lib/ppdb-session"

const FIELD_TYPE_OPTIONS: readonly { value: PpdbFieldType; label: string }[] = [
  { value: "text", label: "Jawaban singkat" },
  { value: "textarea", label: "Paragraf" },
  { value: "number", label: "Angka" },
  { value: "date", label: "Tanggal" },
  { value: "select", label: "Dropdown" },
  { value: "radio", label: "Pilihan tunggal" },
  { value: "checkbox", label: "Pilihan ganda" },
  { value: "file", label: "Upload file" },
]

const TEMPLATE_FIELDS: readonly Omit<PpdbFormField, "id">[] = [
  { label: "Tempat Lahir", type: "text", required: false },
  { label: "Tanggal Lahir", type: "date", required: false },
  { label: "Jenis Kelamin", type: "radio", required: false, options: ["Laki-laki", "Perempuan"] },
  { label: "Alamat", type: "textarea", required: false },
  { label: "Scan KK (Kartu Keluarga)", type: "file", required: false },
  { label: "Scan Surat Keterangan Lulus", type: "file", required: false },
]

function newField(): PpdbFormField {
  return { id: crypto.randomUUID(), label: "Pertanyaan baru", type: "text", required: false }
}

// Perubahan pada sesi aktif disimpan sebagai draft dan baru terlihat publik setelah diterbitkan kembali.
export function PpdbFieldBuilder({
  domain,
  sessionId,
  initialFields,
  publishedFields = [],
  published = false,
}: {
  domain: string
  sessionId: string
  initialFields: readonly PpdbFormField[]
  publishedFields?: readonly PpdbFormField[]
  published?: boolean
}) {
  const normalizedInitialFields = ensurePpdbSystemFields(initialFields)
  const [fields, setFields] = useState<PpdbFormField[]>(() => normalizedInitialFields)
  const fieldsSignature = JSON.stringify(fields)
  const hasDraftChanges = fieldsSignature !== JSON.stringify(normalizedInitialFields)
  const hasUnpublishedChanges = fieldsSignature !== JSON.stringify(publishedFields)

  const patchField = (id: string, patch: Partial<PpdbFormField>) => {
    setFields((current) => current.map((field) => field.id === id ? { ...field, ...patch } : field))
  }
  const addField = () => setFields((current) => [...current, newField()])
  const addTemplateFields = () => setFields((current) => [
    ...current,
    ...TEMPLATE_FIELDS.map((field) => ({ ...field, id: crypto.randomUUID() })),
  ])
  const removeField = (id: string) => setFields((current) => current.filter((field) => field.id !== id))
  const duplicateField = (source: PpdbFormField) => {
    const copy = { ...source, id: crypto.randomUUID(), purpose: undefined, label: `${source.label} (salinan)` }
    const index = fields.findIndex((field) => field.id === source.id)
    setFields((current) => [...current.slice(0, index + 1), copy, ...current.slice(index + 1)])
  }
  const moveField = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= fields.length) return
    setFields((current) => {
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }
  const updateType = (field: PpdbFormField, type: PpdbFieldType) => {
    if (field.purpose) return
    patchField(field.id, {
      type,
      options: ["Pilihan 1", "Pilihan 2"].filter(() => ["select", "radio", "checkbox"].includes(type)),
    })
  }

  return (
    <div className="space-y-6">
      <form action={updateFieldsAction.bind(null, domain)}>
        <input type="hidden" name="sessionId" value={sessionId} />
        <input type="hidden" name="fields" value={JSON.stringify(fields)} />
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold">Struktur Formulir</h2>
            <Button type="button" variant="outline" onClick={addTemplateFields} className="gap-2 border-sky-600 text-sky-700 hover:bg-sky-50">
              <Plus className="size-4" /> Tambahkan Field Template
            </Button>
          </div>
          <p className="mb-6 text-sm text-slate-600">
            Field bertanda Sistem langsung tersedia dan tidak dapat dihapus. Template hanya menambahkan contoh field opsional tanpa mengganti susunan yang sudah dibuat.
          </p>

          <div className="space-y-4">
            {fields.map((field, index) => (
              <section key={field.id} className="rounded-xl border border-slate-200 bg-white p-4 transition-colors focus-within:border-sky-400">
                <div className="flex items-start gap-3">
                  <GripVertical className="mt-2 size-5 shrink-0 text-slate-300" />
                  <div className="min-w-0 flex-1 space-y-4">
                    <div className="grid gap-3 md:grid-cols-[1fr_13rem]">
                      <Label>
                        <span className="text-xs font-semibold text-slate-500">Pertanyaan</span>
                        <Input value={field.label} onChange={(event) => patchField(field.id, { label: event.target.value })} className="mt-1 font-medium" />
                      </Label>
                      <Label>
                        <span className="text-xs font-semibold text-slate-500">Jenis jawaban</span>
                        <Select value={field.type} onValueChange={(value) => updateType(field, value as PpdbFieldType)} items={FIELD_TYPE_OPTIONS} disabled={Boolean(field.purpose)}>
                          <SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger>
                          <SelectContent>{FIELD_TYPE_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </Label>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <Label>
                        <span className="text-xs font-semibold text-slate-500">Deskripsi (opsional)</span>
                        <Input value={field.description ?? ""} onChange={(event) => patchField(field.id, { description: event.target.value })} placeholder="Petunjuk untuk calon siswa" className="mt-1" />
                      </Label>
                      {!isPpdbChoiceField(field) && field.type !== "file" ? (
                        <Label>
                          <span className="text-xs font-semibold text-slate-500">Placeholder (opsional)</span>
                          <Input value={field.placeholder ?? ""} onChange={(event) => patchField(field.id, { placeholder: event.target.value })} className="mt-1" />
                        </Label>
                      ) : null}
                    </div>

                    {isPpdbChoiceField(field) ? (
                      <Label>
                        <span className="text-xs font-semibold text-slate-500">Pilihan jawaban — satu pilihan per baris</span>
                        <Textarea
                          value={(field.options ?? []).join("\n")}
                          onChange={(event) => patchField(field.id, { options: event.target.value.split("\n") })}
                          rows={4}
                          className="mt-1"
                        />
                      </Label>
                    ) : null}

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                      <div className="flex items-center gap-2">
                        {field.purpose ? <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-700">Sistem · tidak dapat dihapus</span> : null}
                        <Label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                          <Checkbox checked={field.required} onCheckedChange={(checked) => patchField(field.id, { required: checked === true })} /> Wajib diisi
                        </Label>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button type="button" variant="ghost" size="icon" onClick={() => moveField(index, -1)} disabled={index === 0} aria-label="Naikkan pertanyaan"><ArrowUp className="size-4" /></Button>
                        <Button type="button" variant="ghost" size="icon" onClick={() => moveField(index, 1)} disabled={index === fields.length - 1} aria-label="Turunkan pertanyaan"><ArrowDown className="size-4" /></Button>
                        <Button type="button" variant="ghost" size="icon" onClick={() => duplicateField(field)} aria-label="Duplikat pertanyaan"><Copy className="size-4" /></Button>
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeField(field.id)} disabled={Boolean(field.purpose)} aria-label="Hapus pertanyaan" className="text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="size-4" /></Button>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            ))}
          </div>

          <Button type="button" variant="outline" onClick={addField} className="mt-6 h-auto w-full gap-2 border-2 border-dashed border-slate-300 p-4 text-slate-500 hover:border-sky-400 hover:bg-sky-50 hover:text-sky-700">
            <Plus className="size-5" /> Tambah pertanyaan
          </Button>
          <div className="mt-6 flex justify-end">
            <PendingSubmitButton idleLabel={published ? "Simpan Draft Perubahan" : "Simpan Form"} pendingLabel="Menyimpan..." icon={<Save className="size-4" />} disabled={!hasDraftChanges} />
          </div>
        </div>
      </form>

      <form action={publishSessionAction.bind(null, domain)} className="flex justify-end">
        <input type="hidden" name="sessionId" value={sessionId} />
        <input type="hidden" name="fields" value={JSON.stringify(fields)} />
        <PendingSubmitButton
          idleLabel={published ? "Publikasikan Perubahan" : "Publikasikan Form PPDB"}
          pendingLabel="Mempublikasikan..."
          icon={<Rocket className="size-4" />}
          disabled={fields.length === 0 || (published && !hasUnpublishedChanges)}
          className="bg-emerald-600 hover:bg-emerald-700"
        />
      </form>
    </div>
  )
}

function PendingSubmitButton({ idleLabel, pendingLabel, icon, disabled = false, className }: { idleLabel: string; pendingLabel: string; icon?: ReactNode; disabled?: boolean; className?: string }) {
  const { pending } = useFormStatus()
  return <Button type="submit" disabled={disabled || pending} className={`gap-2 ${className ?? ""}`}>{pending ? <Loader2 className="size-4 animate-spin" /> : icon}{pending ? pendingLabel : idleLabel}</Button>
}
