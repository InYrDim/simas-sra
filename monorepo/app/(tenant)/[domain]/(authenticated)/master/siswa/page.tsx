import Link from "next/link";
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  EyeIcon,
  PencilIcon,
  RefreshCcwIcon,
  Trash2Icon,
} from "lucide-react";

import {
  manageStudentLifecycleAction,
  saveStudentGuardianAction,
  deleteStudentGuardianAction,
} from "@/app/(tenant)/[domain]/(authenticated)/master/siswa/actions";
import { StudentForm } from "@/app/(tenant)/[domain]/(authenticated)/master/siswa/student-form";
import { MasterDataFormDialog } from "@/components/master-data/master-data-form-dialog";
import { MasterDataWorkspace } from "@/components/master-data/master-data-workspace";
import {
  SchoolPersonArchiveForm,
  SharedPersonImpact,
} from "@/components/master-data/school-person-profile-context";
import { createSchoolPersonMasterDataService } from "@/lib/master-data/school-person-master-data";
import { schoolPersonMasterDataStore } from "@/lib/master-data/school-person-master-data-data";
import {
  createStudentMasterDataService,
  STUDENT_STATUSES,
  type StudentRecord,
  type GuardianRelationship,
} from "@/lib/master-data/student-master-data";
import { studentMasterDataStore } from "@/lib/master-data/student-master-data-data";
import {
  queryStudents,
  STUDENT_ACCOUNT_STATUSES,
  STUDENT_GENDERS,
} from "@/lib/master-data/student-master-data-query";
import {
  serializeMasterDataQuery,
  type MasterDataSearchParams,
} from "@/lib/master-data/master-data-workspace";
import { enforceTenantMasterDataOperation } from "@/lib/authorization/tenant-operation-route-access";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select as UISelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
const statusLabel = {
  active: "Aktif",
  graduated: "Lulus",
  transferred: "Pindah",
  withdrawn: "Keluar",
} as const;
const genderLabel = { female: "Perempuan", male: "Laki-laki" } as const;
const accountStatusLabel = {
  active: "Aktif",
  inactive: "Tidak aktif",
  unlinked: "Tidak tertaut",
} as const;
const messages: Record<string, string> = {
  "person-archived": "Warga Sekolah diarsipkan tanpa mengubah Akun Pengguna.",
  "profile-active": "Arsipkan semua profil terlebih dahulu.",
  saved: "Data Siswa tersimpan.",
  "invalid-input": "Periksa kembali isian wajib dan format identifier.",
  "duplicate-nik": "NIK sudah digunakan Warga Sekolah lain.",
  "duplicate-nip": "NIP sudah digunakan Warga Sekolah lain.",
  "duplicate-nis": "NIS sudah digunakan Siswa lain.",
  "duplicate-nisn": "NISN sudah digunakan Siswa lain.",
  "identifier-conflict":
    "Identifier dimiliki Warga Sekolah dengan identitas yang tidak kompatibel.",
  "link-required":
    "Identifier cocok dengan Warga Sekolah yang ada. Pilih orang tersebut secara eksplisit untuk menambah profil.",
  "duplicate-profile": "Warga Sekolah tersebut sudah memiliki Profil Siswa.",
  "possible-duplicate":
    "Ditemukan identitas serupa. Tinjau kandidat; sistem tidak menggabungkan secara otomatis.",
  conflict:
    "Data berubah sejak dibuka. Isian ditolak agar perubahan lain tidak tertimpa.",
  "not-found": "Siswa tidak ditemukan.",
  archived: "Catatan arsip hanya dapat dibaca.",
  "invalid-transition": "Perubahan status tersebut tidak diizinkan.",
  "invalid-effective-date":
    "Tanggal efektif tidak boleh sebelum tanggal masuk atau periode aktif.",
  "future-transition": "Perubahan status terjadwal belum tersedia.",
  "graduation-correction-required":
    "Status Lulus hanya dapat diperbaiki melalui Koreksi Kelulusan.",
  "active-status": "Profil Aktif tidak dapat diarsipkan.",
  "relationship-blocked":
    "Profil belum dapat diarsipkan karena relationship aktif. Tinjau blocker pada detail.",
  "not-archived": "Profil belum diarsipkan.",
  error: "Data belum dapat disimpan. Coba lagi.",
};
export default async function StudentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ domain: string }>;
  searchParams: Promise<
    MasterDataSearchParams & { result?: string; action?: string }
  >;
}) {
  const [{ domain }, raw] = await Promise.all([params, searchParams]),
    principal = await enforceTenantMasterDataOperation(domain, "students.load", ["people.people.view", "people.people.view-contact", "people.people.view-sensitive", "students.students.view", "students.students.view-sensitive"]),
    service = createStudentMasterDataService({ store: studentMasterDataStore }),
    records = await service.list(principal),
    personService = createSchoolPersonMasterDataService({
      store: schoolPersonMasterDataStore,
    }),
    availablePeople = principal.capabilities.write
      ? await service.listAvailablePeople(principal)
      : [],
    result = queryStudents(records, raw),
    selected = records.find(
      (item) => item.student.id === result.query.selected
    ),
    selectedAggregate = selected
      ? await personService.get(principal, selected.person.id)
      : null,
    basePath = `/${domain}/master/siswa`,
    code = typeof raw.result === "string" ? raw.result : undefined,
    selectedAction =
      raw.action === "edit" ||
        raw.action === "status" ||
        raw.action === "archive"
        ? raw.action
        : "detail";
  const empty =
    result.state === "empty" ? (
      <State
        title="Belum ada Siswa"
        text="Tambah Warga Sekolah dan Profil Siswa pertama tanpa membuat Akun Pengguna."
      />
    ) : result.state === "no-results" ? (
      <State
        title="Tidak ada hasil"
        text="Ubah pencarian, status, atau cakupan arsip."
      />
    ) : undefined;
  return (
    <div className="space-y-6 p-4 md:p-6">
      {code ? (
        <p
          role={code === "saved" ? "status" : "alert"}
          className="rounded-lg border p-3"
        >
          {messages[code] ?? messages.error}
        </p>
      ) : null}
      <MasterDataWorkspace
        title="Siswa"
        description="Kelola identitas Warga Sekolah dan Profil Siswa secara terpisah dari Akun Pengguna."
        basePath={basePath}
        query={result.query}
        total={result.total}
        items={result.items.map(({ person, student, classGroupName }) => {
          const actionHref = (
            action: "detail" | "edit" | "status" | "archive"
          ) =>
            `${basePath}?${serializeMasterDataQuery(result.query, {
              selected: student.id,
            })}${action === "detail" ? "" : `&action=${action}`}`;
          return {
            id: student.id,
            title: person.fullName,
            description: `NIS ${student.nis} · NISN ${student.nisn ?? "—"
              } · Rombongan Belajar ${classGroupName ?? "Belum ada"} · Akun ${person.accountUserId
                ? person.accountActive
                  ? "Aktif"
                  : "Tertaut"
                : "Tidak tertaut"
              }`,
            lifecycle: statusLabel[student.status],
            archived: student.archived,
            actions: (
              <StudentRowActions
                detailHref={actionHref("detail")}
                editHref={actionHref("edit")}
                statusHref={actionHref("status")}
                archiveHref={actionHref("archive")}
                archived={student.archived}
                writable={principal.capabilities.write}
              />
            ),
          };
        })}
        detailTitle={
          selectedAction === "edit"
            ? "Edit siswa"
            : selectedAction === "status"
              ? "Ubah status siswa"
              : selectedAction === "archive"
                ? selected?.student.archived
                  ? "Aktifkan kembali siswa"
                  : "Arsipkan siswa"
                : "Detail siswa"
        }
        detailDescription={
          selectedAction === "detail"
            ? "Informasi identitas dan profil siswa dalam mode hanya-baca."
            : "Lengkapi informasi yang diperlukan, lalu simpan perubahan."
        }
        detail={
          selected ? (
            selectedAction === "edit" && principal.capabilities.write && !selected.student.archived ? (
              <div>
                <p className="text-sm text-muted-foreground">
                  Perubahan data Warga Sekolah berlaku pada profil lain milik orang yang sama.
                </p>
                {selectedAggregate ? (
                  <SharedPersonImpact aggregate={selectedAggregate} current="student" />
                ) : null}
                <StudentForm domain={domain} record={selected} />
                <GuardianSection domain={domain} student={selected.student} guardians={selected.guardians ?? []} />
              </div>
            ) : selectedAction === "status" && principal.capabilities.write && !selected.student.archived ? (
              <LifecycleForm
                domain={domain}
                record={selected}
                direct
                operation={
                  selected.student.status === "graduated"
                    ? "correct-graduation"
                    : "transition"
                }
              />
            ) : selectedAction === "archive" && principal.capabilities.write ? (
              <div className="space-y-4">
                <LifecycleForm
                  domain={domain}
                  record={selected}
                  operation={selected.student.archived ? "reactivate" : "archive"}
                />
                {selectedAggregate ? (
                  <SchoolPersonArchiveForm
                    domain={domain}
                    origin="siswa"
                    selected={selected.student.id}
                    aggregate={selectedAggregate}
                  />
                ) : null}
              </div>
            ) : (
              <StudentDetail record={{ ...selected, guardians: selected.guardians ?? [] }} />
            )
          ) : undefined
        }
        emptyState={empty}
        filters={[
          {
            name: "status",
            label: "Status Siswa",
            options: STUDENT_STATUSES.map((value) => ({
              value,
              label: statusLabel[value],
            })),
          },
          {
            name: "gender",
            label: "Jenis kelamin",
            options: STUDENT_GENDERS.map((value) => ({
              value,
              label: genderLabel[value],
            })),
          },
          {
            name: "classGroup",
            label: "Rombongan belajar",
            options: [...new Set(records.flatMap(({ classGroupName }) =>
              classGroupName ? [classGroupName] : []
            ))]
              .sort((left, right) => left.localeCompare(right, "id-ID"))
              .map((value) => ({ value, label: value })),
          },
          {
            name: "account",
            label: "Status akun",
            options: STUDENT_ACCOUNT_STATUSES.map((value) => ({
              value,
              label: accountStatusLabel[value],
            })),
          },
          {
            name: "entryYear",
            label: "Tahun masuk",
            options: [...new Set(records.map(({ student }) => student.entryDate.slice(0, 4)))]
              .sort((left, right) => right.localeCompare(left))
              .map((value) => ({ value, label: value })),
          },
        ]}
        sortOptions={[
          { value: "name-asc", label: "Nama A–Z" },
          { value: "name-desc", label: "Nama Z–A" },
          { value: "nis-asc", label: "NIS terkecil" },
          { value: "nis-desc", label: "NIS terbesar" },
        ]}
      >
        {principal.capabilities.write ? (
          <MasterDataFormDialog title="Tambah Siswa">
            <StudentForm domain={domain} availablePeople={availablePeople} />
          </MasterDataFormDialog>
        ) : (
          <p className="rounded-lg border p-3 text-sm">
            Workspace hanya-baca. Pembuatan dan perubahan dinonaktifkan.
          </p>
        )}
      </MasterDataWorkspace>
    </div>
  );
}

function StudentRowActions({
  detailHref,
  editHref,
  statusHref,
  archiveHref,
  archived,
  writable,
}: {
  detailHref: string;
  editHref: string;
  statusHref: string;
  archiveHref: string;
  archived: boolean;
  writable: boolean;
}) {
  const iconClass = buttonVariants({ variant: "ghost", size: "icon-sm" });
  const disabled = !writable || archived;

  return (
    <div className="flex items-center justify-end gap-1">
      <Tooltip>
        <TooltipTrigger render={<Link href={detailHref} className={iconClass} />}>
          <EyeIcon aria-hidden="true" />
          <span className="sr-only">Lihat detail siswa</span>
        </TooltipTrigger>
        <TooltipContent>Lihat detail</TooltipContent>
      </Tooltip>
      {disabled ? (
        <span
          aria-disabled="true"
          aria-label="Edit siswa tidak tersedia"
          className={`${iconClass} cursor-not-allowed opacity-40`}
          title="Edit siswa tidak tersedia"
        >
          <PencilIcon aria-hidden="true" />
        </span>
      ) : (
        <Tooltip>
          <TooltipTrigger render={<Link href={editHref} className={iconClass} />}>
            <PencilIcon aria-hidden="true" />
            <span className="sr-only">Edit siswa</span>
          </TooltipTrigger>
          <TooltipContent>Edit siswa</TooltipContent>
        </Tooltip>
      )}
      {disabled ? (
        <span
          aria-disabled="true"
          aria-label="Ubah status siswa tidak tersedia"
          className={`${iconClass} cursor-not-allowed opacity-40`}
          title="Ubah status siswa tidak tersedia"
        >
          <RefreshCcwIcon aria-hidden="true" />
        </span>
      ) : (
        <Tooltip>
          <TooltipTrigger render={<Link href={statusHref} className={iconClass} />}>
            <RefreshCcwIcon aria-hidden="true" />
            <span className="sr-only">Ubah status siswa</span>
          </TooltipTrigger>
          <TooltipContent>Ubah status siswa</TooltipContent>
        </Tooltip>
      )}
      {!writable ? (
        <span
          aria-disabled="true"
          aria-label="Kelola arsip tidak tersedia"
          className={`${iconClass} cursor-not-allowed opacity-40`}
          title="Kelola arsip tidak tersedia"
        >
          {archived ? (
            <ArchiveRestoreIcon aria-hidden="true" />
          ) : (
            <ArchiveIcon aria-hidden="true" />
          )}
        </span>
      ) : (
        <Tooltip>
          <TooltipTrigger render={<Link href={archiveHref} className={iconClass} />}>
            {archived ? (
              <ArchiveRestoreIcon aria-hidden="true" />
            ) : (
              <ArchiveIcon aria-hidden="true" />
            )}
            <span className="sr-only">
              {archived ? "Aktifkan kembali siswa" : "Arsipkan siswa"}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {archived ? "Aktifkan kembali siswa" : "Arsipkan siswa"}
          </TooltipContent>
        </Tooltip>
      )}
      <span
        aria-disabled="true"
        aria-label="Hapus permanen tidak tersedia"
        className={`${iconClass} cursor-not-allowed text-destructive opacity-40`}
        title="Hapus permanen tidak tersedia; gunakan arsip"
      >
        <Trash2Icon aria-hidden="true" />
      </span>
    </div>
  );
}

function StudentDetail({ record }: { record: StudentRecord & { guardians?: readonly GuardianRelationship[] } }) {
  const { person, student, classGroupName, guardians } = record;
  return (
    <div className="space-y-5">
      {student.archived ? (
        <p role="status" className="rounded-lg border p-3">
          Profil diarsipkan dan hanya dapat dibaca. Reactivation tidak
          memulihkan status atau relationship lama.
        </p>
      ) : null}
      {person.accountActive ? (
        <p role="status" className="rounded-lg border p-3">
          Peringatan: Akun Pengguna tertaut masih aktif; akun tidak menghalangi
          archive.
        </p>
      ) : null}
      {record.archiveBlockers?.length ? (
        <section
          className="rounded-lg border p-3"
          aria-labelledby="archive-blockers"
        >
          <h3 id="archive-blockers" className="font-semibold">
            Archive diblokir oleh relationship aktif
          </h3>
          <ul className="mt-2 list-disc pl-5">
            {record.archiveBlockers.map((blocker) => (
              <li key={blocker.id}>{blocker.label}</li>
            ))}
          </ul>
        </section>
      ) : null}
      <section>
        <h3 className="font-semibold">Data pribadi Warga Sekolah</h3>
        <dl className="mt-2 grid gap-3 sm:grid-cols-2">
          <Item label="Nama" value={person.fullName} />
          <Item
            label="Tempat, tanggal lahir"
            value={`${person.birthPlace}, ${person.birthDate}`}
          />
          <Item label="NIK" value={person.nik ?? "—"} />
          <Item label="NIP" value={person.nip ?? "—"} />
          <Item label="Kontak" value={person.phone ?? person.email ?? "—"} />
          <Item label="Alamat" value={person.street} />
        </dl>
      </section>
      <section>
        <h3 className="font-semibold">Profil Siswa</h3>
        <dl className="mt-2 grid gap-3 sm:grid-cols-2">
          <Item label="NIS" value={student.nis} />
          <Item label="NISN" value={student.nisn ?? "—"} />
          <Item label="Tanggal masuk" value={student.entryDate} />
          <Item label="Status" value={statusLabel[student.status]} />
          <Item
            label="Rombongan Belajar"
            value={classGroupName ?? "Belum ada"}
          />
          <Item
            label="Status Akun Pengguna"
            value={
              person.accountUserId
                ? person.accountActive
                  ? "Tertaut dan aktif"
                  : "Tertaut"
                : "Tidak tertaut"
            }
          />
          <Item
            label="Status arsip"
            value={student.archived ? "Diarsipkan" : "Aktif"}
          />
        </dl>
      </section>
      <section>
        <h3 className="font-semibold">Data Wali / Orang Tua</h3>
        {guardians && guardians.length > 0 ? (
          <ul className="mt-2 space-y-2">
            {guardians.map((g) => (
              <li key={g.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{g.label}</p>
                    <p className="text-sm text-muted-foreground">{g.kind}</p>
                    <p className="text-sm font-mono">{g.phone ?? "—"}</p>
                  </div>
                  <span className={`text-xs font-medium ${g.active ? "text-emerald-600" : "text-muted-foreground"}`}>
                    {g.active ? "Aktif" : "Tidak aktif"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Belum ada data wali.</p>
        )}
      </section>

    </div>
  );
}

function GuardianSection({ domain, student, guardians }: { domain: string; student: { id: string; archived: boolean }; guardians: readonly { id?: string; label: string; kind: string; phone: string | null; active: boolean }[] }) {
  return (
    <section className="space-y-3">
      <h3 className="font-semibold">Data Wali / Orang Tua</h3>
      {guardians.length === 0 ? (
        <p className="text-sm text-muted-foreground">Belum ada data wali.</p>
      ) : (
        <ul className="space-y-2">
          {guardians.map((g) => (
            <li key={g.id} className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{g.label}</p>
                  <p className="text-sm text-muted-foreground">{g.kind}</p>
                  <p className="text-sm font-mono">{g.phone ?? "—"}</p>
                </div>
                <form action={deleteStudentGuardianAction.bind(null, domain)} className="flex items-center gap-2">
                  <input type="hidden" name="studentId" value={student.id} />
                  <input type="hidden" name="guardianId" value={g.id} />
                  <Button type="submit" size="icon" variant="ghost" className="size-8 text-destructive">
                    <Trash2Icon aria-hidden="true" className="size-4" />
                    <span className="sr-only">Hapus</span>
                  </Button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
      {!student.archived ? (
        <form action={saveStudentGuardianAction.bind(null, domain)} className="space-y-3 rounded-lg border p-4">
          <input type="hidden" name="studentId" value={student.id} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Label className="flex flex-row items-center gap-3">
              <span className="text-sm font-medium w-20 shrink-0">Nama</span>
              <Input required name="label" placeholder="Nama wali" className="flex-1" />
            </Label>
            <Label className="flex flex-row items-center gap-3">
              <span className="text-sm font-medium w-20 shrink-0">Hubungan</span>
              <Input name="kind" defaultValue="orangtua" placeholder="orangtua / wali" className="flex-1" />
            </Label>
          </div>
          <Label className="flex flex-row items-center gap-3">
            <span className="text-sm font-medium w-20 shrink-0">Nomor WhatsApp</span>
            <Input name="phone" placeholder="62812..." className="flex-1" />
          </Label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="active" defaultChecked className="h-4 w-4 rounded border" />
            Aktif
          </label>
          <Button type="submit" size="sm">Simpan</Button>
        </form>
      ) : null}
    </section>
  );
}

function LifecycleForm({
  domain,
  record,
  operation,
  direct = false,
}: {
  domain: string;
  record: StudentRecord;
  operation: "transition" | "correct-graduation" | "archive" | "reactivate";
  direct?: boolean;
}) {
  const student = record.student,
    title =
      operation === "transition"
        ? "Ubah status Siswa"
        : operation === "correct-graduation"
          ? "Koreksi Kelulusan"
          : operation === "archive"
            ? "Arsipkan Profil Siswa"
            : "Aktifkan kembali Profil Siswa";
  const options =
    student.status === "active"
      ? (["graduated", "transferred", "withdrawn"] as const)
      : student.status === "graduated"
        ? (["active", "transferred", "withdrawn"] as const)
        : (["active"] as const);
  const form = (
    <form
      action={manageStudentLifecycleAction.bind(null, domain)}
      className={direct ? "space-y-4" : "mt-4 space-y-3"}
    >
      <input type="hidden" name="id" value={student.id} />
      <input type="hidden" name="expectedVersion" value={student.version} />
      <input type="hidden" name="operation" value={operation} />
      {operation === "transition" || operation === "correct-graduation" ? (
        <>
          <Label className="block">
            <span className="text-sm font-medium">Status baru</span>
            <UISelect required name="toStatus">
              <SelectTrigger className="mt-1 h-11 w-full border bg-background px-3">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map((value) => (
                  <SelectItem key={value} value={value}>
                    {statusLabel[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </UISelect>
          </Label>
          <Field name="effectiveDate" label="Tanggal efektif" type="date" />
          <Field name="notes" label="Catatan (opsional)" />
        </>
      ) : null}
      <Label className="block">
        <span className="text-sm font-medium">Alasan</span>
        <Textarea
          required
          name="reason"
          className="mt-1 min-h-24 w-full border bg-background p-3"
        />
      </Label>
      <Button className="min-h-11 rounded-full px-4">{title}</Button>
    </form>
  );

  if (direct) return form;

  return (
    <Collapsible className="rounded-lg border p-4">
      <CollapsibleTrigger className="cursor-pointer font-medium">
        {title}
      </CollapsibleTrigger>
      <CollapsibleContent>{form}</CollapsibleContent>
    </Collapsible>
  );
}
function Field({
  name,
  label,
  value,
  type = "text",
}: {
  name: "effectiveDate" | "notes";
  label: string;
  value?: string | null;
  type?: string;
}) {
  return (
    <Label className="block">
      <span className="text-sm font-medium">{label}</span>
      <Input
        required={!label.includes("opsional")}
        name={name}
        type={type}
        defaultValue={value ?? ""}
        className="mt-1 h-11"
      />
    </Label>
  );
}
function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
function State({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
