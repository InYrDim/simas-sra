"use client"

import { useFormStatus } from "react-dom"
import { Loader2 } from "lucide-react"

import { createSessionAction } from "@/app/(tenant)/[domain]/(authenticated)/ulangan/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={pending} className="sm:col-span-2 flex items-center gap-2">
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
      {pending ? "Membuat Sesi Ulangan..." : "Buat Sesi Ulangan"}
    </Button>
  )
}

export function CreateQuizSessionForm({
  domain,
  selectableYears,
  selectableSubjects,
  selectableGroups,
}: {
  domain: string
  selectableYears: { id: string; label: string }[]
  selectableSubjects: { id: string; name: string }[]
  selectableGroups: { id: string; groupName: string; grade: number }[]
}) {
  return (
    <form action={createSessionAction.bind(null, domain)} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2 space-y-1">
        <Label htmlFor="title">Judul Ulangan</Label>
        <Input id="title" name="title" placeholder="Contoh: Ulangan Tengah Semester" required />
      </div>

      <div className="space-y-1">
        <Label htmlFor="mode">Mode Pelaksanaan</Label>
        <Select name="mode" required items={[{ value: "luring", label: "Luring (Offline)" }, { value: "daring", label: "Daring (Online)" }]}>
          <SelectTrigger id="mode" className="w-full">
            <SelectValue placeholder="Pilih Mode" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="luring">Luring (Offline)</SelectItem>
            <SelectItem value="daring">Daring (Online)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="durationMinutes">Durasi (menit, opsional)</Label>
        <Input id="durationMinutes" name="durationMinutes" type="number" min="1" placeholder="Kosongkan jika tidak terbatas" />
      </div>

      <div className="space-y-1">
        <Label htmlFor="academicYearId">Tahun Ajaran</Label>
        <Select name="academicYearId" required items={selectableYears.map((y) => ({ value: y.id, label: y.label }))}>
          <SelectTrigger id="academicYearId" className="w-full">
            <SelectValue placeholder="Pilih Tahun Ajaran" />
          </SelectTrigger>
          <SelectContent>
            {selectableYears.map((y) => (
              <SelectItem key={y.id} value={y.id}>{y.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="subjectId">Mata Pelajaran</Label>
        <Select name="subjectId" required items={selectableSubjects.map((s) => ({ value: s.id, label: s.name }))}>
          <SelectTrigger id="subjectId" className="w-full">
            <SelectValue placeholder="Pilih Mata Pelajaran" />
          </SelectTrigger>
          <SelectContent>
            {selectableSubjects.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="classGroupId">Rombongan Belajar</Label>
        <Select name="classGroupId" required items={selectableGroups.map((g) => ({ value: g.id, label: `${g.groupName} (Kelas ${g.grade})` }))}>
          <SelectTrigger id="classGroupId" className="w-full">
            <SelectValue placeholder="Pilih Rombel" />
          </SelectTrigger>
          <SelectContent>
            {selectableGroups.map((g) => (
              <SelectItem key={g.id} value={g.id}>{g.groupName} (Kelas {g.grade})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="sm:col-span-2 space-y-1">
        <Label htmlFor="description">Deskripsi (opsional)</Label>
        <Textarea id="description" name="description" placeholder="Deskripsi singkat tentang ulangan ini..." rows={3} />
      </div>

      <SubmitButton />
    </form>
  )
}
