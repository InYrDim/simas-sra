import assert from "node:assert/strict";
import test from "node:test";

import { prepareSimasApplication } from "@/lib/simas-application-input";

const validInput = {
  schoolName: "  SMA   Negeri 1  Jakarta ",
  npsn: " 20 10-00 01 ",
  educationLevel: " SMA ",
  address: " Jl.  Pendidikan   No. 1 ",
  contactName: " Siti   Aminah ",
  contactPosition: " Kepala   Sekolah ",
  contactEmail: "  ADMIN@SEKOLAH.SCH.ID ",
  contactWhatsapp: " 0812-3456-7890 ",
  needsNote: "  Integrasi   data siswa  ",
};

test("applicant submission input is normalized into an immutable application snapshot", () => {
  const result = prepareSimasApplication(validInput, {
    createId: () => "application-1",
    now: () => new Date("2026-07-18T10:00:00.000Z"),
  });

  assert.deepEqual(result, {
    ok: true,
    application: {
      id: "application-1",
      schoolName: "SMA Negeri 1 Jakarta",
      npsn: "20100001",
      educationLevel: "SMA",
      address: "Jl. Pendidikan No. 1",
      contactName: "Siti Aminah",
      contactPosition: "Kepala Sekolah",
      contactEmail: "admin@sekolah.sch.id",
      contactWhatsapp: "+6281234567890",
      needsNote: "Integrasi data siswa",
      status: "pending",
      submittedAt: new Date("2026-07-18T10:00:00.000Z"),
      decidedAt: null,
      decidedByProviderAdminId: null,
      rejectionReason: null,
      approvedTenantId: null,
    },
  });
});

test("invalid applicant input is rejected before an application snapshot exists", () => {
  const result = prepareSimasApplication({
    ...validInput,
    npsn: "123",
    contactEmail: "not-an-email",
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.deepEqual(result.errors, {
    npsn: "NPSN harus terdiri dari 8 digit.",
    contactEmail: "Email tidak valid.",
  });
});

test("malformed WhatsApp input is rejected instead of sanitized", () => {
  const result = prepareSimasApplication({
    ...validInput,
    contactWhatsapp: "0812abc34567890",
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.deepEqual(result.errors, {
    contactWhatsapp: "Nomor WhatsApp Indonesia tidak valid.",
  });
});
