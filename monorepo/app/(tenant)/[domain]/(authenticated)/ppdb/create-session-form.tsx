"use client"

import { useFormStatus } from "react-dom"
import { Loader2 } from "lucide-react"

import { createSessionAction } from "@/app/(tenant)/[domain]/(authenticated)/ppdb/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={pending} className="sm:col-span-2 flex items-center gap-2">
      {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
      {pending ? "Membuat Sesi PPDB..." : "Buat Sesi PPDB"}
    </Button>
  )
}

export function CreateSessionForm({
  domain,
  selectableYears,
}: {
  domain: string
  selectableYears: { id: string; label: string }[]
}) {
  return (
    <form action={createSessionAction.bind(null, domain)} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1">
        <Label htmlFor="academicYearId">Tahun Ajaran</Label>
        <Select name="academicYearId" required items={selectableYears.map((year) => ({ value: year.id, label: year.label }))}>
          <SelectTrigger id="academicYearId" className="w-full">
            <SelectValue placeholder="Pilih Tahun Ajaran" />
          </SelectTrigger>
          <SelectContent>
            {selectableYears.map((year) => (
              <SelectItem key={year.id} value={year.id}>
                {year.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="endDate">Tanggal Berakhir Pendaftaran</Label>
        <Input id="endDate" name="endDate" type="date" required />
      </div>
      <SubmitButton />
    </form>
  )
}
