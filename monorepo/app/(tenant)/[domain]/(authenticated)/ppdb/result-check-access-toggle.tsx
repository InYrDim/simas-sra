"use client"

import { useState } from "react"

import { updateResultCheckAccessAction } from "@/app/(tenant)/[domain]/(authenticated)/ppdb/actions"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

export function PpdbResultCheckAccessToggle({
  domain,
  sessionId,
  open: initiallyOpen,
  disabled,
}: {
  domain: string
  sessionId: string
  open: boolean
  disabled: boolean
}) {
  const [open, setOpen] = useState(initiallyOpen)

  return (
    <form action={updateResultCheckAccessAction.bind(null, domain)} className="flex flex-wrap items-center justify-between gap-4">
      <input type="hidden" name="sessionId" value={sessionId} />
      <input type="hidden" name="resultCheckOpen" value={String(open)} />
      <div className="flex items-center gap-3">
        <Switch id="resultCheckOpen" checked={open} onCheckedChange={setOpen} disabled={disabled} />
        <div>
          <Label htmlFor="resultCheckOpen">Akses cek status pendaftar</Label>
          <p className="text-xs text-slate-500">
            {open ? "Pendaftar dapat membuka dan mengecek hasil seleksi." : "Halaman pengumuman ditutup untuk pendaftar."}
          </p>
        </div>
      </div>
      <Button type="submit" variant="outline" disabled={disabled || open === initiallyOpen}>
        Simpan Akses
      </Button>
    </form>
  )
}
