"use client";

import { useState } from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";

import { assignHeadmasterAction } from "@/app/(tenant)/[domain]/(authenticated)/master/profil/actions";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel, FieldContent } from "@/components/ui/field";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { HeadmasterAssignmentView, HeadmasterTeacher } from "@/lib/headmaster-assignment";

const messages: Record<string, string> = { saved: "Kepala Sekolah tersimpan.", "invalid-input": "Tanggal efektif dan alasan wajib valid.", "invalid-teacher": "Pilih Guru aktif yang belum diarsipkan dari sekolah ini.", overlap: "Tanggal efektif bertumpang tindih dengan riwayat Kepala Sekolah.", conflict: "Penugasan berubah bersamaan. Muat ulang lalu coba lagi.", "read-only": "Profil ini hanya dapat dibaca." };

export function HeadmasterHistory({ domain, current, history, teachers, readOnly, result }: { domain: string; current: HeadmasterAssignmentView | null; history: readonly HeadmasterAssignmentView[]; teachers: readonly HeadmasterTeacher[]; readOnly: boolean; result?: string }) {
  const [date, setDate] = useState<Date>();
  
  return <section className="rounded-xl border bg-card p-5" aria-labelledby="headmaster-title">
    <div><h2 id="headmaster-title" className="text-xl font-semibold">Kepala Sekolah</h2><p className="mt-1 text-sm text-muted-foreground">Penugasan menggunakan Guru aktif dan mempertahankan riwayat berdasarkan tanggal efektif.</p></div>
    {result && messages[result] ? <p role={result === "saved" ? "status" : "alert"} className="mt-4 rounded-lg border p-3 text-sm">{messages[result]}</p> : null}
    <div className="mt-5 grid gap-6 lg:grid-cols-2">
      <div><h3 className="font-semibold">Kepala Sekolah saat ini</h3>{current ? <dl className="mt-3 grid gap-2 text-sm"><div><dt className="text-muted-foreground">Nama Guru</dt><dd className="font-medium">{current.teacherName}</dd></div><div><dt className="text-muted-foreground">Mulai menjabat</dt><dd>{current.startedAt}</dd></div><div><dt className="text-muted-foreground">Alasan</dt><dd>{current.reason}</dd></div></dl> : <p className="mt-3 text-sm text-muted-foreground">Belum ada Kepala Sekolah aktif.</p>}</div>
      <div><h3 className="font-semibold">Riwayat sebelumnya</h3><ol className="mt-3 space-y-2">{history.filter((item) => item.endedAt !== null).map((item) => <li key={item.id} className="rounded border p-3 text-sm"><span className="font-medium">{item.teacherName}</span><br />{item.startedAt}–{item.endedAt}<br /><span className="text-muted-foreground">{item.reason}</span></li>)}</ol>{history.every((item) => item.endedAt === null) ? <p className="mt-3 text-sm text-muted-foreground">Belum ada riwayat sebelumnya.</p> : null}</div>
    </div>
    {!readOnly ? <form action={assignHeadmasterAction.bind(null, domain)} className="mt-6 grid gap-4 border-t pt-5 sm:grid-cols-2"><Field><FieldLabel>Guru aktif</FieldLabel><FieldContent><Select required name="teacherId" defaultValue=""><SelectTrigger className="w-full"><SelectValue placeholder="Pilih Guru" /></SelectTrigger><SelectContent>{teachers.map((teacher) => <SelectItem key={teacher.id} value={teacher.id}>{teacher.name}</SelectItem>)}</SelectContent></Select></FieldContent></Field><Field><FieldLabel>Tanggal efektif</FieldLabel><FieldContent><Popover><PopoverTrigger render={<Button variant="outline" className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")} />}><CalendarIcon className="mr-2 size-4" />{date ? format(date, "PPP") : <span>Pilih tanggal</span>}</PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={date} onSelect={setDate} /></PopoverContent></Popover><input type="hidden" name="effectiveDate" value={date ? format(date, "yyyy-MM-dd") : ""} required /></FieldContent></Field><Field className="sm:col-span-2"><FieldLabel>Alasan</FieldLabel><FieldContent><Textarea required name="reason" maxLength={1000} className="min-h-24 w-full" /></FieldContent></Field><Button className="sm:col-span-2 sm:justify-self-start" type="submit">{current ? "Ganti Kepala Sekolah" : "Tetapkan Kepala Sekolah"}</Button></form> : null}
  </section>;
}
