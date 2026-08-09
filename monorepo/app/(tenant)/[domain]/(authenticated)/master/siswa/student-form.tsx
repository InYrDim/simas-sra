"use client";

import { useState, type FormEvent } from "react";

import {
  createStudentAction,
  editStudentAction,
} from "@/app/(tenant)/[domain]/(authenticated)/master/siswa/actions";
import { DatePickerField } from "@/components/master-data/date-picker-field";
import { ValidatedSubmitButton } from "@/components/master-data/validated-submit-button";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select as UISelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  SchoolPerson,
  StudentInput,
  StudentRecord,
} from "@/lib/master-data/student-master-data";
import type { MasterDataFieldError } from "@/components/master-data/master-data-form";

const GENDERS = [
  { value: "female", label: "Perempuan" },
  { value: "male", label: "Laki-laki" },
];

const digits = (value: string) => value.replace(/[^0-9]/g, "");
const validDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?\d{7,15}$/;

function validate(form: FormData, today: string): MasterDataFieldError[] {
  const errors: MasterDataFieldError[] = [];
  const get = (name: string) => String(form.get(name) ?? "").trim();

  const fullName = get("fullName");
  if (fullName.length < 2 || fullName.length > 150)
    errors.push({
      field: "fullName",
      message: "Nama lengkap harus 2–150 karakter.",
    });

  const birthPlace = get("birthPlace");
  if (birthPlace.length < 2 || birthPlace.length > 100)
    errors.push({
      field: "birthPlace",
      message: "Tempat lahir harus 2–100 karakter.",
    });

  const birthDate = get("birthDate");
  if (!validDate(birthDate))
    errors.push({ field: "birthDate", message: "Tanggal lahir tidak valid." });
  else if (birthDate > today)
    errors.push({
      field: "birthDate",
      message: "Tanggal lahir tidak boleh di masa depan.",
    });

  const gender = get("gender");
  if (!["male", "female"].includes(gender))
    errors.push({ field: "gender", message: "Pilih jenis kelamin." });

  const nik = digits(get("nik"));
  if (nik && nik.length !== 16)
    errors.push({ field: "nik", message: "NIK harus 16 digit angka." });

  const nip = digits(get("nip"));
  if (nip && nip.length !== 18)
    errors.push({ field: "nip", message: "NIP harus 18 digit angka." });

  const nisn = digits(get("nisn"));
  if (nisn && nisn.length !== 10)
    errors.push({ field: "nisn", message: "NISN harus 10 digit angka." });

  const email = get("email");
  if (email && !EMAIL_RE.test(email))
    errors.push({ field: "email", message: "Format email tidak valid." });

  const phone = get("phone");
  if (phone && !PHONE_RE.test(phone))
    errors.push({
      field: "phone",
      message: "Nomor telepon harus 7–15 digit angka.",
    });

  if (!get("street"))
    errors.push({ field: "street", message: "Alamat jalan wajib diisi." });

  if (!digits(get("nis")))
    errors.push({ field: "nis", message: "NIS wajib diisi." });

  const entryDate = get("entryDate");
  if (!validDate(entryDate))
    errors.push({ field: "entryDate", message: "Tanggal masuk tidak valid." });

  return errors;
}

export function StudentForm({
  domain,
  record,
  availablePeople = [],
}: {
  domain: string;
  record?: StudentRecord;
  availablePeople?: readonly SchoolPerson[];
}) {
  const action = record ? editStudentAction : createStudentAction;
  const [errors, setErrors] = useState<MasterDataFieldError[]>([]);
  const today = new Date().toISOString().slice(0, 10);
  const errorMap = Object.fromEntries(errors.map((e) => [e.field, e.message]));

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const found = validate(new FormData(event.currentTarget), today);
    setErrors(found);
    if (found.length) event.preventDefault();
  }

  const p = record?.person;
  const s = record?.student;

  return (
    <form
      action={action.bind(null, domain)}
      onSubmit={handleSubmit}
      noValidate
      className="mt-4 space-y-5"
    >
      {errors.length ? (
        <Alert
          aria-labelledby="student-form-error-title"
          className="border-destructive p-4"
        >
          <AlertTitle id="student-form-error-title">
            Periksa kembali isian Anda
          </AlertTitle>
          <ul className="mt-2 list-disc pl-5 text-sm">
            {errors.map((error) => (
              <li key={error.field}>
                <a
                  className="underline focus-visible:ring-2 focus-visible:ring-ring"
                  href={`#${error.field}`}
                >
                  {error.message}
                </a>
              </li>
            ))}
          </ul>
        </Alert>
      ) : null}
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
          <Field name="fullName" label="Nama lengkap" value={p?.fullName} error={errorMap.fullName} />
          <Field
            name="preferredName"
            label="Nama panggilan (opsional)"
            value={p?.preferredName}
          />
          <Field name="birthPlace" label="Tempat lahir" value={p?.birthPlace} error={errorMap.birthPlace} />
          <DatePickerField
            name="birthDate"
            label="Tanggal lahir"
            value={p?.birthDate}
            required
            error={errorMap.birthDate}
          />
          <Select
            name="gender"
            label="Jenis kelamin"
            value={p?.gender}
            options={GENDERS}
            error={errorMap.gender}
          />
          <Field
            name="nik"
            label="NIK 16 digit (opsional)"
            value={p?.nik}
            inputMode="numeric"
            error={errorMap.nik}
          />
          <Field
            name="nip"
            label="NIP 18 digit (opsional)"
            value={p?.nip}
            inputMode="numeric"
            error={errorMap.nip}
          />
          <Field name="religion" label="Agama (opsional)" value={p?.religion} />
          <Field name="street" label="Alamat jalan" value={p?.street} error={errorMap.street} />
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
          <Field name="phone" label="Telepon (opsional)" value={p?.phone} error={errorMap.phone} />
          <Field
            name="email"
            label="Email (opsional)"
            type="email"
            value={p?.email}
            error={errorMap.email}
          />
        </div>
      </fieldset>
      <fieldset className="space-y-3">
        <legend className="font-semibold">Profil Siswa</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field name="nis" label="NIS" value={s?.nis} inputMode="numeric" error={errorMap.nis} />
          <Field
            name="nisn"
            label="NISN 10 digit (opsional)"
            value={s?.nisn}
            inputMode="numeric"
            error={errorMap.nisn}
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
            error={errorMap.entryDate}
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
          {record
            ? "Status tidak dapat diubah melalui edit biasa. Gunakan tindakan Ubah status Siswa."
            : "Siswa baru selalu berstatus Aktif. Pembuatan ini tidak membuat atau menautkan Akun Pengguna."}
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
  error,
}: {
  name: keyof StudentInput | "effectiveDate" | "notes";
  label: string;
  value?: string | null;
  type?: string;
  inputMode?: "numeric";
  error?: string;
}) {
  const invalid = Boolean(error);
  return (
    <Label className="block">
      <span className="text-sm font-medium">{label}</span>
      <Input
        required={!label.includes("opsional")}
        name={name}
        type={type}
        inputMode={inputMode}
        defaultValue={value ?? ""}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${name}-error` : undefined}
        className="mt-1 h-11"
      />
      {invalid ? (
        <span id={`${name}-error`} className="mt-1 block text-sm text-destructive">
          {error}
        </span>
      ) : null}
    </Label>
  );
}

function Select({
  name,
  label,
  value,
  options,
  error,
}: {
  name: string;
  label: string;
  value?: string;
  options: { value: string; label: string }[];
  error?: string;
}) {
  const invalid = Boolean(error);
  return (
    <Label className="block">
      <span className="text-sm font-medium">{label}</span>
      <UISelect
        required
        name={name}
        defaultValue={value ?? ""}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${name}-error` : undefined}
      >
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
      {invalid ? (
        <span id={`${name}-error`} className="mt-1 block text-sm text-destructive">
          {error}
        </span>
      ) : null}
    </Label>
  );
}
