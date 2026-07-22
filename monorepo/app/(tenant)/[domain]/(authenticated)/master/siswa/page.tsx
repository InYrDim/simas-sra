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
  createStudentAction,
  editStudentAction,
  manageStudentLifecycleAction,
} from "@/app/(tenant)/[domain]/(authenticated)/master/siswa/actions";
import { DatePickerField } from "@/components/master-data/date-picker-field";
import { MasterDataFormDialog } from "@/components/master-data/master-data-form-dialog";
import { MasterDataWorkspace } from "@/components/master-data/master-data-workspace";
import { ValidatedSubmitButton } from "@/components/master-data/validated-submit-button";
import {
  SchoolPersonArchiveForm,
  SharedPersonImpact,
} from "@/components/master-data/school-person-profile-context";
import { createSchoolPersonMasterDataService } from "@/lib/school-person-master-data";
import { schoolPersonMasterDataStore } from "@/lib/school-person-master-data-data";
import {
  createStudentMasterDataService,
  STUDENT_STATUSES,
  type SchoolPerson,
  type StudentInput,
  type StudentRecord,
} from "@/lib/student-master-data";
import { studentMasterDataStore } from "@/lib/student-master-data-data";
import {
  queryStudents,
  STUDENT_ACCOUNT_STATUSES,
  STUDENT_GENDERS,
} from "@/lib/student-master-data-query";
import {
  serializeMasterDataQuery,
  type MasterDataSearchParams,
} from "@/lib/master-data-workspace";
import { enforceMasterDataAccess } from "@/lib/tenant-master-data-route-access";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
    principal = await enforceMasterDataAccess(domain, "read"),
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
            description: `NIS ${student.nis} · NISN ${
              student.nisn ?? "—"
            } · Rombongan Belajar ${classGroupName ?? "Belum ada"} · Akun ${
              person.accountUserId
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
              <StudentDetail record={selected} />
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

function StudentDetail({ record }: { record: StudentRecord }) {
  const { person, student, classGroupName } = record;
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

    </div>
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
function StudentForm({
  domain,
  record,
  availablePeople = [],
}: {
  domain: string;
  record?: StudentRecord;
  availablePeople?: readonly SchoolPerson[];
}) {
  const action = record ? editStudentAction : createStudentAction,
    p = record?.person,
    s = record?.student;
  return (
    <form action={action.bind(null, domain)} className="mt-4 space-y-5">
      {record ? (
        <>
          <input type="hidden" name="id" value={s!.id} />
          <input type="hidden" name="personVersion" value={p!.version} />
          <input type="hidden" name="studentVersion" value={s!.version} />
        </>
      ) : null}
      <fieldset className="space-y-3">
        <legend className="font-semibold">Data pribadi Warga Sekolah</legend>
        {!record && availablePeople.length ? (
          <Label className="block">
            <span className="text-sm font-medium">
              Tambahkan profil ke Warga Sekolah yang ada (opsional)
            </span>
            <UISelect name="existingPersonId" defaultValue="">
              <SelectTrigger className="mt-1 h-11 w-full border bg-background px-3">
                <SelectValue placeholder="Buat Warga Sekolah baru" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Buat Warga Sekolah baru</SelectItem>
                {availablePeople.map((person) => (
                  <SelectItem key={person.id} value={person.id}>
                    {person.fullName} · {person.birthPlace}, {person.birthDate}
                  </SelectItem>
                ))}
              </SelectContent>
            </UISelect>
            <span className="mt-1 block text-sm text-muted-foreground">
              Pilih hanya setelah memastikan data pribadi pada formulir sama.
              Sistem tidak menggabungkan data otomatis.
            </span>
          </Label>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field name="fullName" label="Nama lengkap" value={p?.fullName} />
          <Field
            name="preferredName"
            label="Nama panggilan (opsional)"
            value={p?.preferredName}
          />
          <Field name="birthPlace" label="Tempat lahir" value={p?.birthPlace} />
          <DatePickerField
            name="birthDate"
            label="Tanggal lahir"
            value={p?.birthDate}
            required
          />
          <Select
            name="gender"
            label="Jenis kelamin"
            value={p?.gender}
            options={[
              { value: "female", label: "Perempuan" },
              { value: "male", label: "Laki-laki" },
            ]}
          />
          <Field
            name="nik"
            label="NIK 16 digit (opsional)"
            value={p?.nik}
            inputMode="numeric"
          />
          <Field
            name="nip"
            label="NIP 18 digit (opsional)"
            value={p?.nip}
            inputMode="numeric"
          />
          <Field name="religion" label="Agama (opsional)" value={p?.religion} />
          <Field name="street" label="Alamat jalan" value={p?.street} />
          <Field
            name="village"
            label="Desa/kelurahan (opsional)"
            value={p?.village}
          />
          <Field
            name="district"
            label="Kecamatan (opsional)"
            value={p?.district}
          />
          <Field
            name="city"
            label="Kabupaten/kota (opsional)"
            value={p?.city}
          />
          <Field
            name="province"
            label="Provinsi (opsional)"
            value={p?.province}
          />
          <Field
            name="postalCode"
            label="Kode pos (opsional)"
            value={p?.postalCode}
          />
          <Field name="phone" label="Telepon (opsional)" value={p?.phone} />
          <Field
            name="email"
            label="Email (opsional)"
            type="email"
            value={p?.email}
          />
        </div>
      </fieldset>
      <fieldset className="space-y-3">
        <legend className="font-semibold">Profil Siswa</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field name="nis" label="NIS" value={s?.nis} inputMode="numeric" />
          <Field
            name="nisn"
            label="NISN 10 digit (opsional)"
            value={s?.nisn}
            inputMode="numeric"
          />
          <Field
            name="externalStudentId"
            label="Nomor eksternal (opsional)"
            value={s?.externalStudentId}
          />
          <DatePickerField
            name="entryDate"
            label="Tanggal masuk"
            value={s?.entryDate}
            required
          />
        </div>
        {!record ? (
          <Label className="flex min-h-11 items-center gap-2">
            <Checkbox name="confirmDistinct" value="true" />
            Saya sudah meninjau kandidat serupa dan memastikan orang ini
            berbeda.
          </Label>
        ) : null}
        <p className="text-sm text-muted-foreground">
          Siswa baru selalu berstatus Aktif. Pembuatan ini tidak membuat atau
          menautkan Akun Pengguna.
        </p>
      </fieldset>
      <div className="flex justify-end">
        <ValidatedSubmitButton className="min-h-11 rounded-full px-4">
          {record ? "Simpan perubahan" : "Simpan Siswa"}
        </ValidatedSubmitButton>
      </div>
    </form>
  );
}
function Field({
  name,
  label,
  value,
  type = "text",
  inputMode,
}: {
  name: keyof StudentInput | "effectiveDate" | "notes";
  label: string;
  value?: string | null;
  type?: string;
  inputMode?: "numeric";
}) {
  return (
    <Label className="block">
      <span className="text-sm font-medium">{label}</span>
      <Input
        required={!label.includes("opsional")}
        name={name}
        type={type}
        inputMode={inputMode}
        defaultValue={value ?? ""}
        className="mt-1 h-11"
      />
    </Label>
  );
}
function Select({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value?: string;
  options: { value: string; label: string }[];
}) {
  return (
    <Label className="block">
      <span className="text-sm font-medium">{label}</span>
      <UISelect required name={name} defaultValue={value ?? ""}>
        <SelectTrigger className="mt-1 h-11 w-full border bg-background px-3">
          <SelectValue placeholder="Pilih" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="" disabled>
            Pilih
          </SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </UISelect>
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
