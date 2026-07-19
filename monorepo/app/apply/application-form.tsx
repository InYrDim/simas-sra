"use client";

import { useActionState } from "react";

import {
  submitSimasApplicationAction,
  type ApplicationFormState,
} from "@/app/apply/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initialState: ApplicationFormState = { success: false };

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-sm text-destructive">{message}</p>;
}

export function ApplicationForm({ idempotencyKey }: { idempotencyKey: string }) {
  const [state, formAction, pending] = useActionState(
    submitSimasApplicationAction,
    initialState,
  );

  if (state.success) {
    return (
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-6" role="status">
        <h2 className="font-semibold">Pengajuan diterima</h2>
        <p className="mt-2 text-sm text-muted-foreground">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-8">
      <input name="idempotencyKey" type="hidden" value={idempotencyKey} />
      {state.message ? (
        <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          {state.message}
        </p>
      ) : null}

      <fieldset className="grid gap-5 sm:grid-cols-2" disabled={pending}>
        <legend className="mb-4 text-lg font-semibold">Identitas sekolah</legend>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="schoolName">Nama resmi sekolah</Label>
          <Input id="schoolName" name="schoolName" maxLength={255} required />
          <FieldError message={state.errors?.schoolName} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="npsn">NPSN</Label>
          <Input id="npsn" name="npsn" inputMode="numeric" maxLength={20} required />
          <FieldError message={state.errors?.npsn} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="educationLevel">Jenjang pendidikan</Label>
          <Input id="educationLevel" name="educationLevel" maxLength={64} placeholder="Contoh: SMA" required />
          <FieldError message={state.errors?.educationLevel} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="address">Alamat sekolah</Label>
          <Textarea id="address" name="address" required />
          <FieldError message={state.errors?.address} />
        </div>
      </fieldset>

      <fieldset className="grid gap-5 sm:grid-cols-2" disabled={pending}>
        <legend className="mb-4 text-lg font-semibold">Kontak penanggung jawab</legend>
        <div className="space-y-2">
          <Label htmlFor="contactName">Nama penanggung jawab</Label>
          <Input id="contactName" name="contactName" maxLength={255} required />
          <FieldError message={state.errors?.contactName} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contactPosition">Jabatan</Label>
          <Input id="contactPosition" name="contactPosition" maxLength={255} required />
          <FieldError message={state.errors?.contactPosition} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contactEmail">Email</Label>
          <Input id="contactEmail" name="contactEmail" type="email" maxLength={255} required />
          <FieldError message={state.errors?.contactEmail} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contactWhatsapp">WhatsApp</Label>
          <Input id="contactWhatsapp" name="contactWhatsapp" type="tel" maxLength={32} placeholder="0812 3456 7890" required />
          <FieldError message={state.errors?.contactWhatsapp} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="needsNote">Catatan kebutuhan (opsional)</Label>
          <Textarea id="needsNote" name="needsNote" />
          <FieldError message={state.errors?.needsNote} />
        </div>
      </fieldset>

      <Button type="submit" className="w-full sm:w-auto" disabled={pending}>
        {pending ? "Mengirim…" : "Kirim pengajuan"}
      </Button>
    </form>
  );
}
