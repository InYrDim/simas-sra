"use client";

import { useActionState } from "react";

import { saveKelasCloseToleranceAction, type SaveKelasToleranceResult } from "@/app/(tenant)/[domain]/(authenticated)/absensi/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function KelasToleranceForm({
  domain,
  current,
  min,
  max,
}: {
  domain: string;
  current: number;
  min: number;
  max: number;
}) {
  const [state, formAction, pending] = useActionState<SaveKelasToleranceResult, FormData>(
    (_state, formData) => saveKelasCloseToleranceAction(domain, formData),
    { ok: true },
  );

  return (
    <form action={formAction} className="mt-4 flex flex-wrap items-end gap-3">
      <Label htmlFor="kelasCloseToleranceMinutes" className="text-sm">
        Toleransi (menit, {min}–{max})
      </Label>
      <input
        id="kelasCloseToleranceMinutes"
        name="kelasCloseToleranceMinutes"
        type="number"
        required
        min={min}
        max={max}
        step={1}
        defaultValue={current}
        className="w-24 rounded-md border bg-background px-3 py-2 text-sm"
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Menyimpan…" : "Simpan"}
      </Button>
      {state.ok ? null : (
        <p className="text-sm text-destructive" role="alert">
          {state.code === "invalid-input" ? `Nilai harus angka bulat ${min}–${max} menit.` : "Gagal menyimpan — coba lagi."}
        </p>
      )}
    </form>
  );
}
