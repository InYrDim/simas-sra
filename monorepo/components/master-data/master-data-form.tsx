"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export interface MasterDataFieldError { field: string; message: string }

export function MasterDataForm({ children, errors = [], onSubmit, submitLabel = "Simpan" }: {
  children?: ReactNode;
  errors?: MasterDataFieldError[];
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  submitLabel?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const first = errors[0];
    if (first) formRef.current?.querySelector<HTMLElement>(`[name="${CSS.escape(first.field)}"]`)?.focus();
  }, [errors]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); };
    const warnForLink = (event: MouseEvent) => {
      const link = (event.target as Element).closest("a[href]");
      if (dirty && link && !window.confirm("Perubahan belum disimpan. Tinggalkan halaman?")) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", warnForLink, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", warnForLink, true);
    };
  }, [dirty]);

  return <form ref={formRef} onChange={() => setDirty(true)} onSubmit={onSubmit} className="space-y-5" noValidate>
    {errors.length ? <Alert aria-labelledby="form-error-title" className="border-destructive p-4"><AlertTitle id="form-error-title">Periksa kembali isian Anda</AlertTitle><ul className="mt-2 list-disc pl-5 text-sm">{errors.map((error) => <li key={error.field}><a className="underline focus-visible:ring-2 focus-visible:ring-ring" href={`#${error.field}`}>{error.message}</a></li>)}</ul></Alert> : null}
    {children}
    <Button className="rounded-full px-4" type="submit">{submitLabel}</Button>
  </form>;
}
