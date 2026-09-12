"use server";

import { lookupSchoolByNpsn, formatSchoolAddress, type KemendikbudSchool } from "@/lib/external/kemendikbud-school";

export type SchoolLookupState =
  | { status: "idle" }
  | { status: "not-found" }
  | { status: "error" }
  | {
      status: "found";
      schoolName: string;
      npsn: string;
      educationLevel: string;
      address: string;
      source: KemendikbudSchool;
    };

export async function lookupSchoolAction(_prev: SchoolLookupState, formData: FormData): Promise<SchoolLookupState> {
  const npsn = String(formData.get("npsn") ?? "").trim();
  if (!npsn) return { status: "not-found" };
  const result = await lookupSchoolByNpsn(npsn);
  if (!result.found) return { status: result.reason };
  const { school } = result;
  return {
    status: "found",
    schoolName: school.nama,
    npsn: school.npsn,
    educationLevel: school.bentuk_pendidikan,
    address: formatSchoolAddress(school),
    source: school,
  };
}
