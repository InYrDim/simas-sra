"use server";

import { revalidatePath } from "next/cache";

import { createGetSchoolProfileQuery, createUpdateSchoolProfileCommand } from "@/lib/school-profile";
import { schoolProfileStore } from "@/lib/school-profile-data";
import { enforceMasterDataAccess } from "@/lib/tenant-master-data-route-access";

export type SchoolProfileFormValues = Readonly<{
  displayName: string;
  street: string;
  village: string;
  district: string;
  city: string;
  province: string;
  postalCode: string;
  institutionalEmail: string;
  institutionalPhone: string;
  website: string;
  latitude: string;
  longitude: string;
  description: string;
}>;

export type SchoolProfileFormState =
  | { status: "idle" }
  | { status: "saved"; version: number; values: SchoolProfileFormValues }
  | { status: "invalid"; version: number; values: SchoolProfileFormValues; errors: Record<string, string> }
  | { status: "conflict"; version: number; values: SchoolProfileFormValues; message: string }
  | { status: "error"; version: number; values: SchoolProfileFormValues; message: string };

const fields = ["displayName", "street", "village", "district", "city", "province", "postalCode", "institutionalEmail", "institutionalPhone", "website", "latitude", "longitude", "description"] as const;

function valuesFrom(formData: FormData): SchoolProfileFormValues {
  return Object.fromEntries(fields.map((field) => [field, String(formData.get(field) ?? "")])) as unknown as SchoolProfileFormValues;
}

export async function updateSchoolProfileAction(domain: string, _previous: SchoolProfileFormState, formData: FormData): Promise<SchoolProfileFormState> {
  const principal = await enforceMasterDataAccess(domain, "write");
  const values = valuesFrom(formData);
  const version = Number(formData.get("version"));
  const input: Record<string, unknown> = {
    version,
    displayName: values.displayName,
    address: { street: values.street, village: values.village, district: values.district, city: values.city, province: values.province, postalCode: values.postalCode },
    institutionalEmail: values.institutionalEmail,
    institutionalPhone: values.institutionalPhone,
    website: values.website,
    latitude: values.latitude,
    longitude: values.longitude,
    description: values.description,
  };
  const transportFields = new Set([...fields, "version", "street", "village", "district", "city", "province", "postalCode"]);
  for (const [key, value] of formData.entries()) {
    if (!transportFields.has(key as typeof fields[number])) input[key] = value;
  }

  try {
    const result = await createUpdateSchoolProfileCommand({ store: schoolProfileStore })(principal, input);
    if (result.ok) {
      revalidatePath(`/${domain}/master/profil`);
      return { status: "saved", version: result.profile.version, values };
    }
    if (result.code === "invalid-input") return { status: "invalid", version, values, errors: result.errors };
    if (result.code === "conflict") {
      const latest = await createGetSchoolProfileQuery({ store: schoolProfileStore })(principal);
      return { status: "conflict", version: latest.ok ? latest.profile.version : version, values, message: "Profil telah diubah di sesi lain. Isian Anda dipertahankan; periksa lalu simpan kembali." };
    }
    return { status: "error", version, values, message: "Profil sekolah tidak ditemukan." };
  } catch (error) {
    console.error({ event: "school_profile_update_failed", tenantId: principal.tenantId, error });
    return { status: "error", version, values, message: "Profil belum dapat disimpan. Coba lagi." };
  }
}
