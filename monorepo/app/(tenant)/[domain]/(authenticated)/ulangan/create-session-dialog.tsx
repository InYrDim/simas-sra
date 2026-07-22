"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useFormStatus } from "react-dom"
import { Loader2, PlusCircle } from "lucide-react"

import { createSessionAction } from "@/app/(tenant)/[domain]/(authenticated)/ulangan/actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={pending} className="gap-2">
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
      {pending ? "Membuat Sesi..." : "Buat Sesi Ulangan"}
    </Button>
  )
}

export function CreateSessionDialog({
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
  const [open, setOpen] = useState(false)
  const router = useRouter()

  function handleAction(formData: FormData) {
    createSessionAction(domain, formData).then(() => {
      setOpen(false)
      router.refresh()
    }).catch(() => {
      // redirect() throws on success — this is expected
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button className="gap-1.5" />}
      >
        <PlusCircle className="size-4" />
        Buat Sesi Ulangan
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Buat Sesi Ulangan Baru</DialogTitle>
          <DialogDescription>
            Isi informasi di bawah ini untuk membuat sesi ulangan baru.
          </DialogDescription>
        </DialogHeader>

        <form action={handleAction} className="grid gap-4">
          <div className="space-y-1">
            <Label htmlFor="title">Judul Ulangan</Label>
            <Input id="title" name="title" placeholder="Contoh: Ulangan Tengah Semester" required />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="mode">Mode</Label>
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
              <Label htmlFor="durationMinutes">Durasi (menit)</Label>
              <Input id="durationMinutes" name="durationMinutes" type="number" min="1" placeholder="Opsional" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
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
                  <SelectValue placeholder="Pilih Mapel" />
                </SelectTrigger>
                <SelectContent>
                  {selectableSubjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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

          <div className="space-y-1">
            <Label htmlFor="description">Deskripsi (opsional)</Label>
            <Textarea id="description" name="description" placeholder="Deskripsi singkat tentang ulangan ini..." rows={2} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
