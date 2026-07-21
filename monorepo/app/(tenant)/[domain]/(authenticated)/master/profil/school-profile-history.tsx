"use client";

import { useActionState, useState } from "react";

import { addSchoolAccreditationAction, correctSchoolAccreditationAction, uploadSchoolLogoAction, type ProfileHistoryActionState } from "@/app/(tenant)/[domain]/(authenticated)/master/profil/history-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, parseISO } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SchoolAccreditation } from "@/lib/school-accreditation";

const initialState: ProfileHistoryActionState = { status: "idle" };

function Status({ state }: { state: ProfileHistoryActionState }) {
  if (state.status === "idle") return null;
  return <p className={state.status === "saved" ? "text-sm text-primary" : "text-sm text-destructive"} role={state.status === "saved" ? "status" : "alert"}>{state.message}</p>;
}

function AccreditationFields({ record, correction }: { record?: SchoolAccreditation; correction?: boolean }) {
  const [start, setStart] = useState<Date | undefined>(record?.determinationDate ? parseISO(record.determinationDate) : undefined);
  const [end, setEnd] = useState<Date | undefined>(record?.expiryDate ? parseISO(record.expiryDate) : undefined);

  return <div className="grid gap-4 sm:grid-cols-2">
    <div className="space-y-2"><Label htmlFor={`${record?.id ?? "new"}-rating`}>Nilai</Label><Select required name="rating" defaultValue={record?.rating ?? "A"}><SelectTrigger id={`${record?.id ?? "new"}-rating`} className="w-full"><SelectValue placeholder="Pilih Nilai" /></SelectTrigger><SelectContent><SelectItem value="A">A</SelectItem><SelectItem value="B">B</SelectItem><SelectItem value="C">C</SelectItem><SelectItem value="Terakreditasi">Terakreditasi</SelectItem><SelectItem value="Tidak Terakreditasi">Tidak Terakreditasi</SelectItem></SelectContent></Select></div>
    <div className="space-y-2"><Label htmlFor={`${record?.id ?? "new"}-certificate`}>Nomor keputusan/sertifikat</Label><Input defaultValue={record?.certificateNumber} id={`${record?.id ?? "new"}-certificate`} maxLength={100} name="certificateNumber" required /></div>
    <div className="space-y-2 sm:col-span-2"><Label htmlFor={`${record?.id ?? "new"}-issuer`}>Lembaga penerbit</Label><Input defaultValue={record?.issuingInstitution} id={`${record?.id ?? "new"}-issuer`} maxLength={150} name="issuingInstitution" required /></div>
    <div className="space-y-2"><Label htmlFor={`${record?.id ?? "new"}-start`}>Tanggal penetapan</Label>
      <Popover><PopoverTrigger render={<Button type="button" variant="outline" id={`${record?.id ?? "new"}-start`} className={cn("w-full justify-start text-left font-normal", !start && "text-muted-foreground")} />}><CalendarIcon className="mr-2 size-4" />{start ? format(start, "PPP") : <span>Pilih tanggal</span>}</PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={start} onSelect={setStart} /></PopoverContent></Popover>
      <input type="hidden" name="determinationDate" value={start ? format(start, "yyyy-MM-dd") : ""} required />
    </div>
    <div className="space-y-2"><Label htmlFor={`${record?.id ?? "new"}-end`}>Tanggal kedaluwarsa</Label>
      <Popover><PopoverTrigger render={<Button type="button" variant="outline" id={`${record?.id ?? "new"}-end`} className={cn("w-full justify-start text-left font-normal", !end && "text-muted-foreground")} />}><CalendarIcon className="mr-2 size-4" />{end ? format(end, "PPP") : <span>Pilih tanggal</span>}</PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={end} onSelect={setEnd} /></PopoverContent></Popover>
      <input type="hidden" name="expiryDate" value={end ? format(end, "yyyy-MM-dd") : ""} />
    </div>
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
    <section className="rounded-xl border bg-card p-5" aria-labelledby="logo-title"><h2 className="text-xl font-semibold" id="logo-title">Logo sekolah</h2><p className="mt-1 text-sm text-muted-foreground">PNG, JPEG, atau WebP; maksimal 2 MB; persegi minimal 256 × 256 piksel.</p><p className="mt-3 text-sm">{logoAssetId ? "Logo sekolah telah tersimpan." : "Belum ada logo sekolah."}</p>{!readOnly ? <form action={logoAction} className="mt-4 space-y-3"><Label htmlFor="school-logo">Pilih logo baru</Label><Input accept="image/png,image/jpeg,image/webp" id="school-logo" name="logo" required type="file" /><Status state={logoState} /><Button disabled={logoPending} type="submit">{logoPending ? "Mengunggah…" : logoAssetId ? "Ganti logo" : "Unggah logo"}</Button></form> : null}</section>
    <section className="rounded-xl border bg-card p-5" aria-labelledby="accreditation-title"><h2 className="text-xl font-semibold" id="accreditation-title">Riwayat akreditasi</h2><p className="mt-1 text-sm text-muted-foreground">Entri lama dipertahankan. Koreksi membuat entri pengganti dan tidak menimpa sejarah.</p>
      <div className="mt-4 space-y-3">{records.length ? records.map((record) => <article className="rounded-lg border p-4" key={record.id}><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold">{record.rating} · {record.certificateNumber}</h3><p className="text-sm text-muted-foreground">{record.issuingInstitution} · {record.determinationDate}–{record.expiryDate ?? "tanpa batas"}</p>{record.invalidatedAt ? <p className="mt-1 text-sm text-muted-foreground">Dikoreksi: {record.invalidationReason}</p> : null}</div>{!readOnly && !record.invalidatedAt ? <Button onClick={() => setCorrecting(correcting === record.id ? null : record.id)} type="button" variant="outline">Koreksi</Button> : null}</div>{correcting === record.id ? <CorrectionForm domain={domain} record={record} /> : null}</article>) : <p className="text-sm text-muted-foreground">Belum ada riwayat akreditasi.</p>}</div>
      {!readOnly ? <form action={accreditationAction} className="mt-6 space-y-4 border-t pt-5"><h3 className="font-semibold">Tambah riwayat</h3><AccreditationFields /><Status state={accreditationState} /><Button disabled={accreditationPending} type="submit">{accreditationPending ? "Menyimpan…" : "Tambah akreditasi"}</Button></form> : null}
    </section>
  </div>;
}
