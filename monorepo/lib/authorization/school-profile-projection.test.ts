import assert from "node:assert/strict";
import test from "node:test";

import { projectSchoolAccreditations, projectSchoolProfile } from "@/lib/authorization/school-profile-projection";
import type { SchoolAccreditation } from "@/lib/master-data/school-accreditation";
import type { SchoolProfileView } from "@/lib/master-data/school-profile";

const now = new Date("2026-01-01T00:00:00.000Z");
const profile: SchoolProfileView = {
  id: "profile-1", tenantId: "tenant-1",
  provider: { tenantId: "tenant-1", npsn: "123", officialName: "Sekolah A", educationLevel: "SMA", domain: "a.example" },
  displayName: "Sekolah A", address: { street: "Jalan 1", village: "A", district: "B", city: "C", province: "D", postalCode: "12345" },
  institutionalEmail: "school@example.test", institutionalPhone: "+62123", website: "https://example.test",
  latitude: -5, longitude: 120, description: "Sekolah", logoAssetId: "asset-1", version: 1, createdAt: now, updatedAt: now,
  completeness: { requiredMissing: [], recommendedMissing: ["institutionalEmail", "coordinates"] },
};

const accreditation: SchoolAccreditation = {
  id: "accreditation-1", tenantId: "tenant-1", rating: "A", certificateNumber: "SECRET", issuingInstitution: "Issuer",
  determinationDate: "2026-01-01", expiryDate: "2030-01-01", supersedesId: null, correctionId: null,
  invalidationReason: null, invalidatedAt: null, createdByUserId: "user-1", createdAt: now,
};

test("ordinary school profile projection removes contact, coordinates, and protected asset metadata", () => {
  const projected = projectSchoolProfile(profile, false);
  assert.equal(projected.institutionalEmail, null);
  assert.equal(projected.institutionalPhone, null);
  assert.equal(projected.latitude, null);
  assert.equal(projected.longitude, null);
  assert.equal(projected.logoAssetId, null);
  assert.deepEqual(projected.completeness.recommendedMissing, []);
});

test("sensitive school profile projection preserves protected fields", () => {
  assert.equal(projectSchoolProfile(profile, true), profile);
  assert.equal(projectSchoolAccreditations([accreditation], true)[0], accreditation);
  const [projected] = projectSchoolAccreditations([accreditation], false);
  assert.equal(projected.certificateNumber, "Dilindungi");
  assert.equal(projected.createdByUserId, "");
});
