import { archiveSubjectAction, createSubjectAction, editSubjectAction } from "@/app/(tenant)/[domain]/(authenticated)/master/mapel/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { MasterDataFormDialog } from "@/components/master-data/master-data-form-dialog";
import { MasterDataWorkspace } from "@/components/master-data/master-data-workspace";
import { createSubjectCatalogService, SUBJECT_EDUCATION_LEVELS, type Subject, type SubjectEducationLevel } from "@/lib/subject-catalog";
import { subjectCatalogStore } from "@/lib/subject-catalog-data";
import { querySubjects } from "@/lib/subject-catalog-query";
import type { MasterDataSearchParams } from "@/lib/master-data-workspace";
import { enforceMasterDataAccess } from "@/lib/tenant-master-data-route-access";

const levelLabels: Record<SubjectEducationLevel, string> = { SD: "SD", SMP: "SMP", SMA: "SMA", SMK: "SMK" };
const resultMessages: Record<string, string> = {
  saved: "Perubahan Mata Pelajaran tersimpan.",
  "invalid-input": "Periksa kembali isian Mata Pelajaran.",
  "duplicate-code": "Kode sudah digunakan dan tetap dicadangkan, termasuk oleh arsip.",
  "duplicate-name": "Nama sudah digunakan dan tetap dicadangkan, termasuk oleh arsip.",
  conflict: "Catatan berubah sejak dibuka. Muat ulang detail lalu coba lagi.",
  archived: "Mata Pelajaran yang diarsipkan hanya dapat dibaca.",
  "already-archived": "Mata Pelajaran sudah diarsipkan.",
  "not-archived": "Mata Pelajaran tidak sedang diarsipkan.",
  "not-found": "Mata Pelajaran tidak ditemukan.",
  error: "Perubahan tidak dapat disimpan. Coba lagi.",
};

export default async function SubjectsPage({ params, searchParams }: { params: Promise<{ domain: string }>; searchParams: Promise<MasterDataSearchParams & { result?: string }> }) {
  const [{ domain }, raw] = await Promise.all([params, searchParams]);
  const principal = await enforceMasterDataAccess(domain, "read");
  const service = createSubjectCatalogService({ store: subjectCatalogStore });
  const subjects = await service.list(principal);
  const result = querySubjects(subjects, raw);
  const selected = subjects.find((subject) => subject.id === result.query.selected && subject.tenantId === principal.tenantId);
  const basePath = `/${domain}/master/mapel`;
  const writable = principal.capabilities.write;
  const empty = result.state === "empty"
    ? <State title="Belum ada Mata Pelajaran" description="Buat entri pertama agar katalog dapat digunakan fitur sekolah lain." />
    : result.state === "no-results"
      ? <State title="Tidak ada hasil" description="Ubah pencarian, jenjang, atau cakupan arsip." />
      : undefined;
  const detail = selected ? <SubjectDetail domain={domain} subject={selected} writable={writable} /> : empty;
  const resultCode = typeof raw.result === "string" ? raw.result : undefined;

  return <div className="space-y-6 p-4 md:p-6">
    {resultCode ? <p role={resultCode === "saved" ? "status" : "alert"} className="rounded-lg border p-3">{resultMessages[resultCode] ?? resultMessages.error}</p> : null}
    <MasterDataWorkspace
      title="Mata Pelajaran"
      description="Kelola katalog referensi stabil tanpa Guru, Rombongan Belajar, jadwal, beban mengajar, atau nilai ketuntasan."
      basePath={basePath}
      query={result.query}
      items={result.items.map((subject) => ({ id: subject.id, title: subject.name, description: `${subject.code} · ${subject.educationLevels.map((level) => levelLabels[level]).join(", ")}`, lifecycle: "Tersedia", archived: subject.archived }))}
      total={result.total}
      detail={detail}
      emptyState={empty}
      filters={[{ name: "level", label: "Jenjang", options: SUBJECT_EDUCATION_LEVELS.map((level) => ({ value: level, label: levelLabels[level] })) }]}
      sortOptions={[{ value: "name-asc", label: "Nama A–Z" }, { value: "name-desc", label: "Nama Z–A" }, { value: "code-asc", label: "Kode A–Z" }, { value: "code-desc", label: "Kode Z–A" }]}
    >
      {writable ? <MasterDataFormDialog title="Buat Mata Pelajaran"><SubjectForm domain={domain} action="create" /></MasterDataFormDialog> : <p className="rounded-lg border p-3 text-sm">Workspace hanya-baca. Pembuatan dan perubahan dinonaktifkan.</p>}
    </MasterDataWorkspace>
  </div>;
}

function SubjectDetail({ domain, subject, writable }: { domain: string; subject: Subject; writable: boolean }) {
  return <div className="space-y-5">
    {subject.archived ? <p role="status" className="rounded-lg border p-3">Catatan ini diarsipkan, tetap dapat dibaca, dan tidak dapat diubah sebelum diaktifkan kembali.</p> : null}
    <dl className="grid gap-3 sm:grid-cols-2">
      <div><dt className="text-sm text-muted-foreground">Kode</dt><dd className="font-medium">{subject.code}</dd></div>
      <div><dt className="text-sm text-muted-foreground">Nama</dt><dd className="font-medium">{subject.name}</dd></div>
      <div><dt className="text-sm text-muted-foreground">Jenjang berlaku</dt><dd>{subject.educationLevels.join(", ")}</dd></div>
      <div><dt className="text-sm text-muted-foreground">Status arsip</dt><dd>{subject.archived ? "Diarsipkan" : "Aktif"}</dd></div>
      <div className="sm:col-span-2"><dt className="text-sm text-muted-foreground">Deskripsi</dt><dd>{subject.description ?? "Tidak ada deskripsi"}</dd></div>
    </dl>
    {writable && !subject.archived ? <Collapsible className="rounded-lg border p-4"><CollapsibleTrigger className="cursor-pointer font-medium">Ubah Mata Pelajaran</CollapsibleTrigger><CollapsibleContent><SubjectForm domain={domain} action="edit" subject={subject} /></CollapsibleContent></Collapsible> : null}
    {writable ? <form action={archiveSubjectAction.bind(null, domain)} className="rounded-lg border p-4"><input type="hidden" name="id" value={subject.id} /><input type="hidden" name="version" value={subject.version} /><input type="hidden" name="operation" value={subject.archived ? "reactivate" : "archive"} /><p className="mb-3 text-sm">{subject.archived ? "Reactivation memvalidasi ulang identitas katalog saat ini." : "Arsip mempertahankan kode, identitas, riwayat, dan referensi."}</p><Button variant="outline">{subject.archived ? "Aktifkan kembali" : "Arsipkan"}</Button></form> : <p className="text-sm text-muted-foreground">Detail hanya-baca.</p>}
  </div>;
}

function SubjectForm({ domain, action, subject }: { domain: string; action: "create" | "edit"; subject?: Subject }) {
  const serverAction = action === "create" ? createSubjectAction : editSubjectAction;
  return <form action={serverAction.bind(null, domain)} className="mt-4 space-y-4">
    {subject ? <><input type="hidden" name="id" value={subject.id} /><input type="hidden" name="version" value={subject.version} /></> : null}
    <div className="grid gap-4 sm:grid-cols-2"><Field name="code" label="Kode" defaultValue={subject?.code} maxLength={30} /><Field name="name" label="Nama" defaultValue={subject?.name} maxLength={150} /></div>
    <fieldset><legend className="text-sm font-medium">Jenjang berlaku</legend><div className="mt-2 flex flex-wrap gap-4">{SUBJECT_EDUCATION_LEVELS.map((level) => <div key={level} className="flex items-center gap-2"><Checkbox id={`level-${level}`} name="educationLevels" value={level} defaultChecked={subject?.educationLevels.includes(level)} /><Label htmlFor={`level-${level}`}>{levelLabels[level]}</Label></div>)}</div></fieldset>
    <div className="space-y-1"><Label htmlFor="description">Deskripsi <span className="font-normal text-muted-foreground">(opsional)</span></Label><Textarea id="description" name="description" maxLength={1000} defaultValue={subject?.description ?? ""} className="min-h-24" /></div>
    <Button>{action === "create" ? "Simpan Mata Pelajaran" : "Simpan perubahan"}</Button>
  </form>;
}

function Field({ name, label, defaultValue, maxLength }: { name: string; label: string; defaultValue?: string; maxLength: number }) {
  return <div className="space-y-1"><Label htmlFor={name}>{label}</Label><Input id={name} required name={name} defaultValue={defaultValue} maxLength={maxLength} /></div>;
}
function State({ title, description }: { title: string; description: string }) { return <div role="status"><h3 className="font-medium">{title}</h3><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>; }
