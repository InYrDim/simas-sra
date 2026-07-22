import Link from "next/link";
import { ArchiveIcon, ArchiveRestoreIcon, EyeIcon, PencilIcon, Trash2Icon } from "lucide-react";

import { archiveSubjectAction, createSubjectAction, editSubjectAction } from "@/app/(tenant)/[domain]/(authenticated)/master/mapel/actions";
import { SubjectIdentityFields } from "@/app/(tenant)/[domain]/(authenticated)/master/mapel/subject-identity-fields";
import { SubjectSubmitButton } from "@/app/(tenant)/[domain]/(authenticated)/master/mapel/subject-submit-button";

import { Textarea } from "@/components/ui/textarea";

import { Label } from "@/components/ui/label";
import { buttonVariants } from "@/components/ui/button";
import { MasterDataFormDialog } from "@/components/master-data/master-data-form-dialog";
import { MasterDataWorkspace } from "@/components/master-data/master-data-workspace";
import { createSubjectCatalogService, type Subject } from "@/lib/subject-catalog";
import { subjectCatalogStore } from "@/lib/subject-catalog-data";
import { querySubjects } from "@/lib/subject-catalog-query";
import { serializeMasterDataQuery, type MasterDataSearchParams } from "@/lib/master-data-workspace";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { enforceMasterDataAccess } from "@/lib/tenant-master-data-route-access";


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

export default async function SubjectsPage({ params, searchParams }: { params: Promise<{ domain: string }>; searchParams: Promise<MasterDataSearchParams & { result?: string; action?: string }> }) {
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
      ? <State title="Tidak ada hasil" description="Ubah pencarian atau cakupan arsip." />
      : undefined;
  const selectedAction = raw.action === "edit" || raw.action === "archive" ? raw.action : "detail";
  const detail = selected
    ? selectedAction === "edit" && writable && !selected.archived
      ? <SubjectForm domain={domain} action="edit" subject={selected} />
      : selectedAction === "archive" && writable
        ? <SubjectArchiveForm domain={domain} subject={selected} />
        : <SubjectDetail subject={selected} />
    : empty;
  const resultCode = typeof raw.result === "string" ? raw.result : undefined;

  return <div className="space-y-6 p-4 md:p-6">
    {resultCode ? <p role={resultCode === "saved" ? "status" : "alert"} className="rounded-lg border p-3">{resultMessages[resultCode] ?? resultMessages.error}</p> : null}
    <MasterDataWorkspace
      title="Mata Pelajaran"
      description="Kelola katalog referensi stabil tanpa Guru, Rombongan Belajar, jadwal, beban mengajar, atau nilai ketuntasan."
      basePath={basePath}
      query={result.query}
      items={result.items.map((subject) => {
        const actionHref = (action: "detail" | "edit" | "archive") =>
          `${basePath}?${serializeMasterDataQuery(result.query, { selected: subject.id })}${action === "detail" ? "" : `&action=${action}`}`;
        return {
          id: subject.id,
          title: subject.name,
          description: subject.code,
          lifecycle: "Tersedia",
          archived: subject.archived,
          actions: <SubjectRowActions
            detailHref={actionHref("detail")}
            editHref={actionHref("edit")}
            archiveHref={actionHref("archive")}
            archived={subject.archived}
            writable={writable}
          />,
        };
      })}
      total={result.total}
      detailTitle={selectedAction === "edit" ? "Edit Mata Pelajaran" : selectedAction === "archive" ? selected?.archived ? "Aktifkan kembali Mata Pelajaran" : "Arsipkan Mata Pelajaran" : "Detail Mata Pelajaran"}
      detailDescription={selectedAction === "detail" ? "Informasi Mata Pelajaran dalam mode hanya-baca." : "Tinjau data dan simpan tindakan yang dipilih."}
      detail={detail}
      emptyState={empty}

      sortOptions={[{ value: "name-asc", label: "Nama A–Z" }, { value: "name-desc", label: "Nama Z–A" }, { value: "code-asc", label: "Kode A–Z" }, { value: "code-desc", label: "Kode Z–A" }]}
    >
      {writable ? <MasterDataFormDialog title="Buat Mata Pelajaran"><SubjectForm domain={domain} action="create" /></MasterDataFormDialog> : <p className="rounded-lg border p-3 text-sm">Workspace hanya-baca. Pembuatan dan perubahan dinonaktifkan.</p>}
    </MasterDataWorkspace>
  </div>;
}

function SubjectRowActions({ detailHref, editHref, archiveHref, archived, writable }: { detailHref: string; editHref: string; archiveHref: string; archived: boolean; writable: boolean }) {
  const iconClass = buttonVariants({ variant: "ghost", size: "icon-sm" });
  const editDisabled = !writable || archived;
  return <div className="flex items-center justify-end gap-1">
    <Tooltip><TooltipTrigger render={<Link href={detailHref} className={iconClass} />}><EyeIcon aria-hidden="true" /><span className="sr-only">Lihat detail Mata Pelajaran</span></TooltipTrigger><TooltipContent>Lihat detail</TooltipContent></Tooltip>
    {editDisabled ? <span aria-disabled="true" aria-label="Edit Mata Pelajaran tidak tersedia" className={`${iconClass} cursor-not-allowed opacity-40`} title="Edit Mata Pelajaran tidak tersedia"><PencilIcon aria-hidden="true" /></span> : <Tooltip><TooltipTrigger render={<Link href={editHref} className={iconClass} />}><PencilIcon aria-hidden="true" /><span className="sr-only">Edit Mata Pelajaran</span></TooltipTrigger><TooltipContent>Edit Mata Pelajaran</TooltipContent></Tooltip>}
    {!writable ? <span aria-disabled="true" aria-label="Kelola arsip tidak tersedia" className={`${iconClass} cursor-not-allowed opacity-40`} title="Kelola arsip tidak tersedia">{archived ? <ArchiveRestoreIcon aria-hidden="true" /> : <ArchiveIcon aria-hidden="true" />}</span> : <Tooltip><TooltipTrigger render={<Link href={archiveHref} className={iconClass} />}>{archived ? <ArchiveRestoreIcon aria-hidden="true" /> : <ArchiveIcon aria-hidden="true" />}<span className="sr-only">{archived ? "Aktifkan kembali Mata Pelajaran" : "Arsipkan Mata Pelajaran"}</span></TooltipTrigger><TooltipContent>{archived ? "Aktifkan kembali" : "Arsipkan"}</TooltipContent></Tooltip>}
    <span aria-disabled="true" aria-label="Hapus permanen tidak tersedia" className={`${iconClass} cursor-not-allowed text-destructive opacity-40`} title="Hapus permanen tidak tersedia; gunakan arsip"><Trash2Icon aria-hidden="true" /></span>
  </div>;
}

function SubjectDetail({ subject }: { subject: Subject }) {
  return <div className="space-y-5">
    {subject.archived ? <p role="status" className="rounded-lg border p-3">Catatan ini diarsipkan dan hanya dapat dibaca.</p> : null}
    <dl className="grid gap-3 sm:grid-cols-2">
      <div><dt className="text-sm text-muted-foreground">Kode</dt><dd className="font-medium">{subject.code}</dd></div>
      <div><dt className="text-sm text-muted-foreground">Nama</dt><dd className="font-medium">{subject.name}</dd></div>
      <div><dt className="text-sm text-muted-foreground">Status arsip</dt><dd>{subject.archived ? "Diarsipkan" : "Aktif"}</dd></div>
      <div className="sm:col-span-2"><dt className="text-sm text-muted-foreground">Deskripsi</dt><dd>{subject.description ?? "Tidak ada deskripsi"}</dd></div>
    </dl>
  </div>;
}

function SubjectArchiveForm({ domain, subject }: { domain: string; subject: Subject }) {
  return <form action={archiveSubjectAction.bind(null, domain)} className="space-y-4">
    <input type="hidden" name="id" value={subject.id} />
    <input type="hidden" name="version" value={subject.version} />
    <input type="hidden" name="operation" value={subject.archived ? "reactivate" : "archive"} />
    <p className="text-sm text-muted-foreground">{subject.archived ? "Aktivasi kembali memvalidasi ulang identitas katalog saat ini." : "Arsip mempertahankan kode, identitas, riwayat, dan referensi Mata Pelajaran."}</p>
    <SubjectSubmitButton>{subject.archived ? "Aktifkan kembali" : "Arsipkan"}</SubjectSubmitButton>
  </form>;
}

function SubjectForm({ domain, action, subject }: { domain: string; action: "create" | "edit"; subject?: Subject }) {
  const serverAction = action === "create" ? createSubjectAction : editSubjectAction;
  return <form action={serverAction.bind(null, domain)} className="mt-4 space-y-4">
    {subject ? <><input type="hidden" name="id" value={subject.id} /><input type="hidden" name="version" value={subject.version} /></> : null}
    <SubjectIdentityFields
      create={action === "create"}
      defaultCode={subject?.code}
      defaultName={subject?.name}
    />

    <div className="space-y-1"><Label htmlFor="description">Deskripsi <span className="font-normal text-muted-foreground">(opsional)</span></Label><Textarea id="description" name="description" maxLength={1000} defaultValue={subject?.description ?? ""} className="min-h-24" /></div>
    <SubjectSubmitButton>
      {action === "create" ? "Simpan Mata Pelajaran" : "Simpan perubahan"}
    </SubjectSubmitButton>
  </form>;
}

function State({ title, description }: { title: string; description: string }) { return <div role="status"><h3 className="font-medium">{title}</h3><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>; }
