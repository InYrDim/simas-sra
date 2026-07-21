"use client";

import { useState, type FormEvent } from "react";

import { MasterDataForm, type MasterDataFieldError } from "@/components/master-data/master-data-form";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export function WorkspaceFormExample() {
  const [errors, setErrors] = useState<MasterDataFieldError[]>([]);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get("example-name") ?? "");
    setErrors(name.trim() ? [] : [{ field: "example-name", message: "Nama contoh wajib diisi." }]);
  }
  return <MasterDataForm errors={errors} onSubmit={submit} submitLabel="Validasi contoh">
    <Label className="block max-w-md"><span className="text-sm font-medium">Nama contoh</span><Input id="example-name" name="example-name" aria-invalid={errors.length > 0} aria-describedby={errors.length ? "example-name-error" : undefined} className="mt-1 h-10 w-full" />{errors.length ? <span id="example-name-error" className="mt-1 block text-sm text-destructive">{errors[0]?.message}</span> : null}</Label>
  </MasterDataForm>;
}
