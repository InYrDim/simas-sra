"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";

import {
  submitSimasApplicationAction,
  type ApplicationFormState,
} from "@/app/apply/actions";
import { lookupSchoolAction, type SchoolLookupState } from "@/app/apply/lookup-school";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const initialState: ApplicationFormState = { success: false };
const lookupInitial: SchoolLookupState = { status: "idle" };

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-sm text-destructive">{message}</p>;
}

// Triggers the NPSN lookup without nesting a <form> inside the main form.
// Reads the NPSN value from the main form via formRef and calls the server
// action directly inside a transition.
function SchoolLookupButton({
  disabled,
  formRef,
  onResult,
}: {
  disabled: boolean;
  formRef: React.RefObject<HTMLFormElement | null>;
  onResult: (state: SchoolLookupState) => void;
}) {
  const [lookup, lookupAction, lookupPending] = useActionState(lookupSchoolAction, lookupInitial);
  const [transitioning, startTransition] = useTransition();
  useEffect(() => {
    if (lookup.status !== "idle") onResult(lookup);
  }, [lookup, onResult]);
  return (
    <Button
      type="button"
      variant="outline"
      disabled={disabled || lookupPending || transitioning}
      onClick={() => {
        const el = formRef.current?.elements.namedItem("npsn") as HTMLInputElement | null;
        const fd = new FormData();
        fd.set("npsn", el?.value ?? "");
        startTransition(() => {
          void lookupAction(fd);
        });
      }}
    >
      {lookupPending || transitioning ? "Mencari…" : "Cari data sekolah"}
    </Button>
  );
}

export function ApplicationForm({
  idempotencyKey,
  initial,
}: {
  idempotencyKey: string;
  initial?: Readonly<{
      schoolName: string;
      npsn: string;
      educationLevel: string;
      address: string;
      contactName: string;
      contactPosition: string;
      contactEmail: string;
      contactWhatsapp: string;
      needsNote: string | null;
    }>;
}) {
  const [state, formAction, pending] = useActionState(
    submitSimasApplicationAction,
    initialState,
  );
  const [lookup, setLookup] = useState<SchoolLookupState>(lookupInitial);
  const formRef = useRef<HTMLFormElement>(null);

  // Toggle between NPSN lookup and manual entry for school identity.
  const [mode, setMode] = useState<"npsn" | "manual">(initial?.npsn ? "npsn" : "manual");
  const [school, setSchool] = useState({
    schoolName: initial?.schoolName ?? "",
    npsn: initial?.npsn ?? "",
    educationLevel: initial?.educationLevel ?? "",
    address: initial?.address ?? "",
  });

  // Store looked-up school data so it survives mode switches.
  useEffect(() => {
    if (lookup.status !== "found") return;
    setSchool({
      schoolName: lookup.schoolName,
      npsn: lookup.npsn,
      educationLevel: lookup.educationLevel,
      address: lookup.address,
    });
  }, [lookup]);

  const showAutofilled = lookup.status === "found" || Boolean(initial?.schoolName);

  if (state.success) {
    return (
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-6" role="status">
        <h2 className="font-semibold">Pengajuan diterima</h2>
        <p className="mt-2 text-sm text-muted-foreground">{state.message}</p>
      </div>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-8">
      <input name="idempotencyKey" type="hidden" value={idempotencyKey} />
      {state.message ? (
        <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          {state.message}
        </p>
      ) : null}

      <fieldset className="grid gap-5 sm:grid-cols-2" disabled={pending}>
        <legend className="mb-4 text-lg font-semibold">Identitas sekolah</legend>

        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <Button type="button" variant={mode === "npsn" ? "default" : "outline"} onClick={() => setMode("npsn")}>
            Isi melalui NPSN
          </Button>
          <Button type="button" variant={mode === "manual" ? "default" : "outline"} onClick={() => setMode("manual")}>
            Input manual
          </Button>
        </div>

        {mode === "npsn" ? (
          <>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="npsn">NPSN</Label>
              <div className="flex items-end gap-2">
                <Input
                  id="npsn"
                  name="npsn"
                  inputMode="numeric"
                  maxLength={20}
                  value={school.npsn}
                  onChange={(e) => setSchool((s) => ({ ...s, npsn: e.target.value }))}
                  readOnly={Boolean(initial?.npsn)}
                  required
                />
                <SchoolLookupButton disabled={Boolean(initial?.npsn)} formRef={formRef} onResult={setLookup} />
              </div>
              <p className="text-sm text-muted-foreground">Klik Cari untuk mengisi nama, jenjang, dan alamat sekolah otomatis.</p>
              {lookup.status === "not-found" ? (
                <p className="text-sm text-destructive">NPSN tidak ditemukan di data resmi sekolah.</p>
              ) : lookup.status === "error" ? (
                <p className="text-sm text-destructive">Gagal mengambil data sekolah. Coba lagi nanti.</p>
              ) : null}
              <FieldError message={state.errors?.npsn} />
            </div>
            <div className="space-y-2 sm:col-span-2" hidden={!showAutofilled}>
              <Label htmlFor="schoolName">Nama resmi sekolah</Label>
              <Input id="schoolName" name="schoolName" maxLength={255} value={school.schoolName} readOnly required />
              <FieldError message={state.errors?.schoolName} />
            </div>
            <div className="space-y-2" hidden={!showAutofilled}>
              <Label htmlFor="educationLevel">Jenjang pendidikan</Label>
              <Input id="educationLevel" name="educationLevel" maxLength={64} placeholder="Contoh: SMA" value={school.educationLevel} readOnly required />
              <FieldError message={state.errors?.educationLevel} />
            </div>
            <div className="space-y-2 sm:col-span-2" hidden={!showAutofilled}>
              <Label htmlFor="address">Alamat sekolah</Label>
              <Textarea id="address" name="address" value={school.address} readOnly required />
              <FieldError message={state.errors?.address} />
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="schoolName">Nama resmi sekolah</Label>
              <Input
                id="schoolName"
                name="schoolName"
                maxLength={255}
                value={school.schoolName}
                onChange={(e) => setSchool((s) => ({ ...s, schoolName: e.target.value }))}
                required
              />
              <FieldError message={state.errors?.schoolName} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="npsn">NPSN</Label>
              <Input
                id="npsn"
                name="npsn"
                inputMode="numeric"
                maxLength={20}
                value={school.npsn}
                onChange={(e) => setSchool((s) => ({ ...s, npsn: e.target.value }))}
                readOnly={Boolean(initial?.npsn)}
                required
              />
              <FieldError message={state.errors?.npsn} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="educationLevel">Jenjang pendidikan</Label>
              <Input
                id="educationLevel"
                name="educationLevel"
                maxLength={64}
                placeholder="Contoh: SMA"
                value={school.educationLevel}
                onChange={(e) => setSchool((s) => ({ ...s, educationLevel: e.target.value }))}
                required
              />
              <FieldError message={state.errors?.educationLevel} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="address">Alamat sekolah</Label>
              <Textarea
                id="address"
                name="address"
                value={school.address}
                onChange={(e) => setSchool((s) => ({ ...s, address: e.target.value }))}
                required
              />
              <FieldError message={state.errors?.address} />
            </div>
          </>
        )}
      </fieldset>

      <fieldset className="grid gap-5 sm:grid-cols-2" disabled={pending}>
        <legend className="mb-4 text-lg font-semibold">Kontak penanggung jawab</legend>
        <div className="space-y-2">
          <Label htmlFor="contactName">Nama penanggung jawab</Label>
          <Input id="contactName" name="contactName" maxLength={255} defaultValue={initial?.contactName ?? ""} required />
          <FieldError message={state.errors?.contactName} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contactPosition">Jabatan</Label>
          <Input id="contactPosition" name="contactPosition" maxLength={255} defaultValue={initial?.contactPosition ?? ""} required />
          <FieldError message={state.errors?.contactPosition} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contactEmail">Email</Label>
          <Input id="contactEmail" name="contactEmail" type="email" maxLength={255} defaultValue={initial?.contactEmail ?? ""} required />
          <FieldError message={state.errors?.contactEmail} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contactWhatsapp">WhatsApp</Label>
          <Input id="contactWhatsapp" name="contactWhatsapp" type="tel" maxLength={32} placeholder="0812 3456 7890" defaultValue={initial?.contactWhatsapp ?? ""} required />
          <FieldError message={state.errors?.contactWhatsapp} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="needsNote">Catatan kebutuhan (opsional)</Label>
          <Textarea id="needsNote" name="needsNote" defaultValue={initial?.needsNote ?? ""} />
          <FieldError message={state.errors?.needsNote} />
        </div>
      </fieldset>

      <Button type="submit" className="w-full sm:w-auto" disabled={pending}>
        {pending ? "Mengirim…" : "Kirim pengajuan"}
      </Button>
    </form>
  );
}
