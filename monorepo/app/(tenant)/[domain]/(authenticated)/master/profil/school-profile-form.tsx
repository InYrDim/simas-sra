"use client";

import { useActionState, useEffect, useRef } from "react";

import { updateSchoolProfileAction, type SchoolProfileFormState, type SchoolProfileFormValues } from "@/app/(tenant)/[domain]/(authenticated)/master/profil/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

function ErrorMessage({ message }: { message?: string }) { return message ? <p className="text-sm text-destructive">{message}</p> : null; }

export function SchoolProfileForm({ domain, version, initial, readOnly }: { domain: string; version: number; initial: SchoolProfileFormValues; readOnly: boolean }) {
  const action = updateSchoolProfileAction.bind(null, domain);
  const [state, formAction, pending] = useActionState<SchoolProfileFormState, FormData>(action, { status: "idle" });
  const formRef = useRef<HTMLFormElement>(null);
  const values = "values" in state ? state.values : initial;
  const currentVersion = "version" in state ? state.version : version;
  const errors = state.status === "invalid" ? state.errors : {};
  const firstErrorField = state.status === "invalid" ? Object.keys(state.errors)[0]?.replace("address.", "") : undefined;

  useEffect(() => {
    if (firstErrorField) formRef.current?.querySelector<HTMLElement>(`[name="${CSS.escape(firstErrorField)}"]`)?.focus();
  }, [firstErrorField]);

  return <form ref={formRef} action={formAction} className="space-y-6" key={`${state.status}-${currentVersion}`} noValidate>
    <input name="version" type="hidden" value={currentVersion} />
    {state.status === "saved" ? <p className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm" role="status">Profil sekolah berhasil disimpan.</p> : null}
    {state.status === "conflict" || state.status === "error" ? <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm" role="alert">{state.message}</p> : null}
    {Object.keys(errors).length ? <Alert variant="destructive"><AlertTitle>Periksa kembali isian Anda</AlertTitle><AlertDescription><ul className="mt-2 list-disc pl-5 text-sm">{Object.entries(errors).map(([field, message]) => <li key={field}><a href={`#${field.replace("address.", "")}`}>{message}</a></li>)}</ul></AlertDescription></Alert> : null}
    <fieldset className="grid gap-5 sm:grid-cols-2" disabled={pending || readOnly}>
      <legend className="mb-4 text-lg font-semibold">Informasi operasional</legend>
      <div className="space-y-2 sm:col-span-2"><Label htmlFor="displayName">Nama tampilan <span aria-hidden="true">*</span></Label><Input id="displayName" name="displayName" maxLength={255} defaultValue={values.displayName} aria-invalid={Boolean(errors.displayName)} required /><ErrorMessage message={errors.displayName} /></div>
      <div className="space-y-2 sm:col-span-2"><Label htmlFor="street">Alamat jalan <span aria-hidden="true">*</span></Label><Input id="street" name="street" maxLength={255} defaultValue={values.street} aria-invalid={Boolean(errors["address.street"])} required /><ErrorMessage message={errors["address.street"]} /></div>
      <div className="space-y-2"><Label htmlFor="village">Desa/Kelurahan</Label><Input id="village" name="village" maxLength={255} defaultValue={values.village} /></div>
      <div className="space-y-2"><Label htmlFor="district">Kecamatan</Label><Input id="district" name="district" maxLength={255} defaultValue={values.district} /></div>
      <div className="space-y-2"><Label htmlFor="city">Kabupaten/Kota <span aria-hidden="true">*</span></Label><Input id="city" name="city" maxLength={255} defaultValue={values.city} aria-invalid={Boolean(errors["address.city"])} required /><ErrorMessage message={errors["address.city"]} /></div>
      <div className="space-y-2"><Label htmlFor="province">Provinsi <span aria-hidden="true">*</span></Label><Input id="province" name="province" maxLength={255} defaultValue={values.province} aria-invalid={Boolean(errors["address.province"])} required /><ErrorMessage message={errors["address.province"]} /></div>
      <div className="space-y-2"><Label htmlFor="postalCode">Kode pos</Label><Input id="postalCode" name="postalCode" inputMode="numeric" maxLength={5} defaultValue={values.postalCode} aria-invalid={Boolean(errors["address.postalCode"])} /><ErrorMessage message={errors["address.postalCode"]} /></div>
      <div className="space-y-2"><Label htmlFor="institutionalEmail">Email institusi</Label><Input id="institutionalEmail" name="institutionalEmail" type="email" maxLength={255} defaultValue={values.institutionalEmail} aria-invalid={Boolean(errors.institutionalEmail)} /><ErrorMessage message={errors.institutionalEmail} /></div>
      <div className="space-y-2"><Label htmlFor="institutionalPhone">Telepon institusi</Label><Input id="institutionalPhone" name="institutionalPhone" type="tel" maxLength={32} defaultValue={values.institutionalPhone} aria-invalid={Boolean(errors.institutionalPhone)} /><ErrorMessage message={errors.institutionalPhone} /></div>
      <div className="space-y-2"><Label htmlFor="website">Website HTTPS</Label><Input id="website" name="website" type="url" maxLength={2048} placeholder="https://sekolah.sch.id" defaultValue={values.website} aria-invalid={Boolean(errors.website)} /><ErrorMessage message={errors.website} /></div>
      <div className="space-y-2"><Label htmlFor="latitude">Latitude</Label><Input id="latitude" name="latitude" type="number" step="any" defaultValue={values.latitude} aria-invalid={Boolean(errors.latitude || errors.coordinates)} /><ErrorMessage message={errors.latitude} /></div>
      <div className="space-y-2"><Label htmlFor="longitude">Longitude</Label><Input id="longitude" name="longitude" type="number" step="any" defaultValue={values.longitude} aria-invalid={Boolean(errors.longitude || errors.coordinates)} /><ErrorMessage message={errors.longitude ?? errors.coordinates} /></div>
      <div className="space-y-2 sm:col-span-2"><Label htmlFor="description">Deskripsi sekolah</Label><Textarea id="description" name="description" maxLength={2000} defaultValue={values.description} aria-invalid={Boolean(errors.description)} /><ErrorMessage message={errors.description} /></div>
    </fieldset>
    {!readOnly ? <Button type="submit" disabled={pending}>{pending ? "Menyimpan…" : "Simpan profil"}</Button> : <p className="text-sm text-muted-foreground">Tenant sedang dalam mode baca saja. Perubahan tidak dapat disimpan.</p>}
  </form>;
}
