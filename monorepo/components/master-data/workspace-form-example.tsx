"use client";

import { useState, type FormEvent } from "react";

import { MasterDataForm, type MasterDataFieldError } from "@/components/master-data/master-data-form";

export function WorkspaceFormExample() {
  const [errors, setErrors] = useState<MasterDataFieldError[]>([]);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get("example-name") ?? "");
    setErrors(name.trim() ? [] : [{ field: "example-name", message: "Nama contoh wajib diisi." }]);
  }
  return <MasterDataForm errors={errors} onSubmit={submit} submitLabel="Validasi contoh">
    <label className="block max-w-md"><span className="text-sm font-medium">Nama contoh</span><input id="example-name" name="example-name" aria-invalid={errors.length > 0} aria-describedby={errors.length ? "example-name-error" : undefined} className="mt-1 h-10 w-full border bg-background px-3 focus-visible:ring-3 focus-visible:ring-ring/50" />{errors.length ? <span id="example-name-error" className="mt-1 block text-sm text-destructive">{errors[0]?.message}</span> : null}</label>
  </MasterDataForm>;
}
