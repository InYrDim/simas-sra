import type { SchoolAccreditation } from "@/lib/master-data/school-accreditation";
import type { SchoolProfileView } from "@/lib/master-data/school-profile";

const sensitiveCompletenessFields = new Set(["institutionalEmail", "institutionalPhone", "coordinates"]);

export function projectSchoolProfile(
  profile: SchoolProfileView,
  sensitive: boolean,
): SchoolProfileView {
  if (sensitive) return profile;
  return {
    ...profile,
    institutionalEmail: null,
    institutionalPhone: null,
    latitude: null,
    longitude: null,
    logoAssetId: null,
    completeness: {
      ...profile.completeness,
      recommendedMissing: profile.completeness.recommendedMissing.filter(
        (field) => !sensitiveCompletenessFields.has(field),
      ),
    },
  };
}

export function projectSchoolAccreditations(
  records: readonly SchoolAccreditation[],
  sensitive: boolean,
): readonly SchoolAccreditation[] {
  if (sensitive) return records;
  return records.map((record) => ({
    ...record,
    certificateNumber: "Dilindungi",
    issuingInstitution: "Dilindungi",
    determinationDate: "Dilindungi",
    expiryDate: null,
    invalidationReason: null,
    createdByUserId: "",
  }));
}
