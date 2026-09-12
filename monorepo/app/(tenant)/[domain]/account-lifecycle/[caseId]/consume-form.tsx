"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Memverifikasi…" : "Konfirmasi"}
    </Button>
  );
}

export function LifecycleConsumeForm({ action, hasError }: { action: (formData: FormData) => void | Promise<void>; hasError: boolean }) {
  return (
    <form action={action} className="space-y-4" noValidate={false}>
      <Input aria-label="Secret sekali pakai" autoComplete="one-time-code" name="secret" required type="password" />
      <SubmitButton />
      {hasError ? <p className="text-sm text-destructive" role="alert">Secret tidak valid atau sudah kedaluwarsa.</p> : null}
    </form>
  );
}
