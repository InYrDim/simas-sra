"use client"

import type { ReactNode } from "react"
import { useState } from "react"
import { useFormStatus } from "react-dom"
import { Download, GripVertical, Loader2, Plus, Save, Trash2 } from "lucide-react"

import { publishSessionAction, updateFieldsAction } from "@/app/(tenant)/[domain]/(authenticated)/ppdb/actions"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { PpdbFieldType, PpdbFormField } from "@/lib/ppdb-session"

const FIELD_TYPE_OPTIONS: readonly { value: PpdbFieldType; label: string }[] = [
  { value: "text", label: "TEXT" },
  { value: "number", label: "NUMBER" },
  { value: "file", label: "FILE UPLOAD" },
  { value: "select", label: "DROPDOWN" },
]

const TEMPLATE_FIELDS: PpdbFormField[] = [
  { id: "t1", label: "Nama Lengkap Sesuai Ijazah", type: "text", required: true, purpose: "studentName" },
  { id: "t2", label: "NISN", type: "number", required: true, purpose: "nisn" },
  { id: "t3", label: "Tempat, Tanggal Lahir", type: "text", required: true },
  { id: "t4", label: "Scan KK (Kartu Keluarga)", type: "file", required: true },
  { id: "t5", label: "Scan Surat Keterangan Lulus", type: "file", required: false },
]

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
  const [fields, setFields] = useState<PpdbFormField[]>(() => [...initialFields])
  const fieldsSignature = JSON.stringify(fields)
  const hasDraftChanges = fieldsSignature !== JSON.stringify(initialFields)
  const hasUnpublishedChanges = fieldsSignature !== JSON.stringify(publishedFields)

  const applyTemplate = () => setFields([...TEMPLATE_FIELDS])
  const addField = () => setFields([...fields, { id: crypto.randomUUID(), label: "Field Baru", type: "text", required: false }])
  const removeField = (id: string) => setFields(fields.filter((field) => field.id !== id))
  const toggleRequired = (id: string) => setFields(fields.map((field) => (field.id === id ? { ...field, required: !field.required } : field)))
  const updateLabel = (id: string, label: string) => setFields(fields.map((field) => (field.id === id ? { ...field, label } : field)))
  const updateType = (id: string, type: PpdbFieldType) => setFields(fields.map((field) => (field.id === id ? { ...field, type } : field)))

  return (
    <div className="space-y-6">
      <form action={updateFieldsAction.bind(null, domain)}>
        <input type="hidden" name="sessionId" value={sessionId} />
        <input type="hidden" name="fields" value={JSON.stringify(fields)} />
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <h2 className="font-bold text-lg">Struktur Formulir</h2>
            <Button type="button" variant="outline" onClick={applyTemplate} className="flex items-center gap-2 border-sky-600 text-sky-700 hover:bg-sky-50">
              <Download className="size-4" />
              Gunakan Template Sistem
            </Button>
          </div>
          <p className="text-sm text-slate-600 mb-6">
            Kelola field form yang akan diisi oleh Calon Siswa. Perubahan pada sesi aktif tetap menjadi draft sampai diterbitkan kembali.
          </p>

          <div className="space-y-3">
            {fields.map((field) => (
              <div key={field.id} className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-sky-300">
                <GripVertical className="size-5 text-slate-300 cursor-grab" />
                <div className="flex-1 min-w-48">
                  <Input value={field.label} onChange={(event) => updateLabel(field.id, event.target.value)} className="w-full max-w-sm font-medium" />
                  <div className="mt-2 w-32">
                    <Select value={field.type} onValueChange={(value) => updateType(field.id, value as PpdbFieldType)} items={FIELD_TYPE_OPTIONS}>
                      <SelectTrigger className="text-xs font-semibold uppercase h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">TEXT</SelectItem>
                        <SelectItem value="number">NUMBER</SelectItem>
                        <SelectItem value="file">FILE UPLOAD</SelectItem>
                        <SelectItem value="select">DROPDOWN</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                  <Checkbox checked={field.required} onCheckedChange={() => toggleRequired(field.id)} />
                  Wajib Isi
                </Label>

                <div className="w-px h-8 bg-slate-200 mx-2" />

                <Button type="button" variant="ghost" size="icon" onClick={() => removeField(field.id)} className="text-slate-400 hover:text-red-600 hover:bg-red-50">
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={addField}
            className="mt-6 flex w-full h-auto items-center justify-center gap-2 border-2 border-dashed border-slate-300 p-4 text-sm font-semibold text-slate-500 hover:border-sky-400 hover:bg-sky-50 hover:text-sky-700"
          >
            <Plus className="size-5" />
            Tambah Field Baru
          </Button>

          <div className="mt-6 flex justify-end">
            <PendingSubmitButton
              idleLabel={published ? "Simpan Draft Perubahan" : "Simpan Form"}
              pendingLabel={published ? "Menyimpan Draft..." : "Menyimpan Form..."}
              icon={<Save className="size-4" />}
              disabled={!hasDraftChanges}
            />
          </div>
        </div>
      </form>

      <form action={publishSessionAction.bind(null, domain)} className="flex justify-end">
        <input type="hidden" name="sessionId" value={sessionId} />
        <input type="hidden" name="fields" value={JSON.stringify(fields)} />
        <PendingSubmitButton
          idleLabel={published ? "Publikasikan Perubahan" : "Publikasikan Form PPDB"}
          pendingLabel={published ? "Mempublikasikan Perubahan..." : "Mempublikasikan Form..."}
          disabled={fields.length === 0 || (published && !hasUnpublishedChanges)}
          className="bg-emerald-600 hover:bg-emerald-700"
        />
      </form>
      {fields.length === 0 ? <p className="text-right text-sm text-slate-500">Simpan Form dengan minimal satu field sebelum dapat dipublikasikan.</p> : null}
    </div>
  )
}

function PendingSubmitButton({
  idleLabel,
  pendingLabel,
  icon,
  disabled = false,
  className,
}: {
  idleLabel: string
  pendingLabel: string
  icon?: ReactNode
  disabled?: boolean
  className?: string
}) {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={disabled || pending} className={`flex items-center gap-2 ${className ?? ""}`}>
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : icon}
      {pending ? pendingLabel : idleLabel}
    </Button>
  )
}
