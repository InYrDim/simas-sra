"use client"

import { useState, use } from "react"
import { Plus, Trash2, Download, GripVertical, Save, Eye } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type FieldType = "text" | "number" | "file" | "select"
type FormField = { id: string; label: string; type: FieldType; required: boolean }

const INITIAL_FIELDS: FormField[] = [
  { id: "1", label: "Nama Lengkap", type: "text", required: true },
  { id: "2", label: "NISN", type: "number", required: true },
]

const TEMPLATE_FIELDS: FormField[] = [
  { id: "t1", label: "Nama Lengkap Sesuai Ijazah", type: "text", required: true },
  { id: "t2", label: "NISN", type: "number", required: true },
  { id: "t3", label: "Tempat, Tanggal Lahir", type: "text", required: true },
  { id: "t4", label: "Scan KK (Kartu Keluarga)", type: "file", required: true },
  { id: "t5", label: "Scan Surat Keterangan Lulus", type: "file", required: false },
]

export default function PPDBSettingsPage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain } = use(params)
  const [fields, setFields] = useState<FormField[]>(INITIAL_FIELDS)
  const [isSaving, setIsSaving] = useState(false)

  const applyTemplate = () => {
    setFields([...TEMPLATE_FIELDS])
  }

  const addField = () => {
    setFields([...fields, { id: Math.random().toString(), label: "Field Baru", type: "text", required: false }])
  }

  const removeField = (id: string) => {
    setFields(fields.filter(f => f.id !== id))
  }

  const toggleRequired = (id: string) => {
    setFields(fields.map(f => f.id === id ? { ...f, required: !f.required } : f))
  }

  const saveForm = async () => {
    setIsSaving(true)
    // TODO: Call server action to save fields to db
    setTimeout(() => {
      alert("Form berhasil disimpan!")
      setIsSaving(false)
    }, 1000)
  }

  return (
    <main className="min-h-svh bg-slate-50 text-slate-950 pb-20">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Pengaturan Form PPDB</h1>
          <p className="text-sm text-slate-500">Domain: {domain} • Tahun Ajaran 2026/2027</p>
        </div>
        <div className="flex gap-3">
          <Button render={<Link href={`/apply/${domain}`} target="_blank" />} variant="outline" className="flex items-center gap-2">
            <Eye className="size-4" />
            Preview Form
          </Button>
          <Button variant="outline" onClick={applyTemplate} className="flex items-center gap-2 border-sky-600 text-sky-700 hover:bg-sky-50">
            <Download className="size-4" />
            Gunakan Template Sistem
          </Button>
          <Button onClick={saveForm} disabled={isSaving} className="flex items-center gap-2">
            <Save className="size-4" />
            {isSaving ? "Menyimpan..." : "Simpan Form"}
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-4xl p-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <h2 className="font-bold text-lg mb-2">Struktur Formulir</h2>
          <p className="text-sm text-slate-600 mb-6">Kelola field form yang akan diisi oleh pendaftar. Gunakan tombol template di kanan atas untuk menggunakan struktur standar yang direkomendasikan.</p>
          
          <div className="space-y-3">
            {fields.map((field: FormField) => (
              <div key={field.id} className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-sky-300">
                <GripVertical className="size-5 text-slate-300 cursor-grab" />
                <div className="flex-1">
                  <Input defaultValue={field.label} className="w-full max-w-sm font-medium" />
                  <div className="mt-2 w-32">
                    <Select defaultValue={field.type}>
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
                
                <Button variant="ghost" size="icon" onClick={() => removeField(field.id)} className="text-slate-400 hover:text-red-600 hover:bg-red-50">
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>

          <Button variant="outline" onClick={addField} className="mt-6 flex w-full h-auto items-center justify-center gap-2 border-2 border-dashed border-slate-300 p-4 text-sm font-semibold text-slate-500 hover:border-sky-400 hover:bg-sky-50 hover:text-sky-700">
            <Plus className="size-5" />
            Tambah Field Baru
          </Button>
        </div>
      </div>
    </main>
  )
}
