"use client";

import { useActionState, useState } from "react";

import { addSchoolAccreditationAction, correctSchoolAccreditationAction, uploadSchoolLogoAction, type ProfileHistoryActionState } from "@/app/(tenant)/[domain]/(authenticated)/master/profil/history-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SchoolAccreditation } from "@/lib/school-accreditation";

const initialState: ProfileHistoryActionState = { status: "idle" };

function Status({ state }: { state: ProfileHistoryActionState }) {
  if (state.status === "idle") return null;
  return <p className={state.status === "saved" ? "text-sm text-primary" : "text-sm text-destructive"} role={state.status === "saved" ? "status" : "alert"}>{state.message}</p>;
}

function AccreditationFields({ record, correction }: { record?: SchoolAccreditation; correction?: boolean }) {
  return <div className="grid gap-4 sm:grid-cols-2">
    <div className="space-y-2"><Label htmlFor={`${record?.id ?? "new"}-rating`}>Nilai</Label><select className="h-9 w-full rounded-md border bg-background px-3 text-sm" defaultValue={record?.rating ?? "A"} id={`${record?.id ?? "new"}-rating`} name="rating"><option>A</option><option>B</option><option>C</option><option>Terakreditasi</option><option>Tidak Terakreditasi</option></select></div>
    <div className="space-y-2"><Label htmlFor={`${record?.id ?? "new"}-certificate`}>Nomor keputusan/sertifikat</Label><Input defaultValue={record?.certificateNumber} id={`${record?.id ?? "new"}-certificate`} maxLength={100} name="certificateNumber" required /></div>
    <div className="space-y-2 sm:col-span-2"><Label htmlFor={`${record?.id ?? "new"}-issuer`}>Lembaga penerbit</Label><Input defaultValue={record?.issuingInstitution} id={`${record?.id ?? "new"}-issuer`} maxLength={150} name="issuingInstitution" required /></div>
    <div className="space-y-2"><Label htmlFor={`${record?.id ?? "new"}-start`}>Tanggal penetapan</Label><Input defaultValue={record?.determinationDate} id={`${record?.id ?? "new"}-start`} name="determinationDate" type="date" required /></div>
    <div className="space-y-2"><Label htmlFor={`${record?.id ?? "new"}-end`}>Tanggal kedaluwarsa</Label><Input defaultValue={record?.expiryDate ?? ""} id={`${record?.id ?? "new"}-end`} name="expiryDate" type="date" /></div>
    {correction ? <div className="space-y-2 sm:col-span-2"><Label htmlFor={`${record!.id}-reason`}>Alasan koreksi</Label><Input id={`${record!.id}-reason`} maxLength={500} name="correctionReason" required /></div> : null}
  </div>;
}

function CorrectionForm({ domain, record }: { domain: string; record: SchoolAccreditation }) {
  const [state, action, pending] = useActionState(correctSchoolAccreditationAction.bind(null, domain, record.id), initialState);
  return <form action={action} className="mt-4 space-y-4 rounded-lg border p-4"><AccreditationFields correction record={record} /><Status state={state} /><Button disabled={pending} type="submit">{pending ? "Menyimpan…" : "Simpan koreksi"}</Button></form>;
}

export function SchoolProfileHistory({ domain, logoAssetId, records, readOnly }: { domain: string; logoAssetId: string | null; records: readonly SchoolAccreditation[]; readOnly: boolean }) {
  const [logoState, logoAction, logoPending] = useActionState(uploadSchoolLogoAction.bind(null, domain), initialState);
  const [accreditationState, accreditationAction, accreditationPending] = useActionState(addSchoolAccreditationAction.bind(null, domain), initialState);
  const [correcting, setCorrecting] = useState<string | null>(null);
  return <div className="space-y-6">
    <section className="rounded-xl border bg-card p-5" aria-labelledby="logo-title"><h2 className="text-xl font-semibold" id="logo-title">Logo sekolah</h2><p className="mt-1 text-sm text-muted-foreground">PNG, JPEG, atau WebP; maksimal 2 MB; persegi minimal 256 × 256 piksel.</p><p className="mt-3 text-sm">{logoAssetId ? "Logo sekolah telah tersimpan." : "Belum ada logo sekolah."}</p>{!readOnly ? <form action={logoAction} className="mt-4 space-y-3" encType="multipart/form-data"><Label htmlFor="school-logo">Pilih logo baru</Label><Input accept="image/png,image/jpeg,image/webp" id="school-logo" name="logo" required type="file" /><Status state={logoState} /><Button disabled={logoPending} type="submit">{logoPending ? "Mengunggah…" : logoAssetId ? "Ganti logo" : "Unggah logo"}</Button></form> : null}</section>
    <section className="rounded-xl border bg-card p-5" aria-labelledby="accreditation-title"><h2 className="text-xl font-semibold" id="accreditation-title">Riwayat akreditasi</h2><p className="mt-1 text-sm text-muted-foreground">Entri lama dipertahankan. Koreksi membuat entri pengganti dan tidak menimpa sejarah.</p>
      <div className="mt-4 space-y-3">{records.length ? records.map((record) => <article className="rounded-lg border p-4" key={record.id}><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold">{record.rating} · {record.certificateNumber}</h3><p className="text-sm text-muted-foreground">{record.issuingInstitution} · {record.determinationDate}–{record.expiryDate ?? "tanpa batas"}</p>{record.invalidatedAt ? <p className="mt-1 text-sm text-muted-foreground">Dikoreksi: {record.invalidationReason}</p> : null}</div>{!readOnly && !record.invalidatedAt ? <Button onClick={() => setCorrecting(correcting === record.id ? null : record.id)} type="button" variant="outline">Koreksi</Button> : null}</div>{correcting === record.id ? <CorrectionForm domain={domain} record={record} /> : null}</article>) : <p className="text-sm text-muted-foreground">Belum ada riwayat akreditasi.</p>}</div>
      {!readOnly ? <form action={accreditationAction} className="mt-6 space-y-4 border-t pt-5"><h3 className="font-semibold">Tambah riwayat</h3><AccreditationFields /><Status state={accreditationState} /><Button disabled={accreditationPending} type="submit">{accreditationPending ? "Menyimpan…" : "Tambah akreditasi"}</Button></form> : null}
    </section>
  </div>;
}
