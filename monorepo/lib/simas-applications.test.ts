import assert from "node:assert/strict";
import test from "node:test";

import {
  createSimasApplicationCommands,
  type NewSimasApplication,
  type SimasApplicationWriter,
} from "@/lib/simas-applications";

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

function recordingWriter() {
  const applications: NewSimasApplication[] = [];
  const writer: SimasApplicationWriter = {
    create(application) {
      applications.push(structuredClone(application));
      return Promise.resolve();
    },
  };

  return { applications, writer };
}

test("a school submits one normalized pending SIMAS application", async () => {
  const { applications, writer } = recordingWriter();

  const commands = createSimasApplicationCommands(writer, {
    createId: () => "application-1",
    now: () => new Date("2026-07-18T10:00:00.000Z"),
  });
  const result = await commands.submit(validInput);

  assert.deepEqual(result, { ok: true, applicationId: "application-1" });
  assert.deepEqual(applications, [
    {
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
  ]);
});

test("invalid input creates no partial SIMAS application", async () => {
  const { applications, writer } = recordingWriter();

  const commands = createSimasApplicationCommands(writer);
  const result = await commands.submit({
    ...validInput,
    npsn: "123",
    contactEmail: "not-an-email",
  });

  assert.equal(result.ok, false);
  assert.deepEqual(applications, []);
});

test("resubmissions with the same NPSN and email remain independent history", async () => {
  const { applications, writer } = recordingWriter();

  await createSimasApplicationCommands(writer, {
    createId: () => "application-1",
  }).submit(validInput);
  await createSimasApplicationCommands(writer, {
    createId: () => "application-2",
  }).submit(validInput);

  assert.deepEqual(
    applications.map(({ id }) => id),
    ["application-1", "application-2"],
  );
});

test("submitted fields cannot be edited through application commands", async () => {
  const { applications, writer } = recordingWriter();
  const commands = createSimasApplicationCommands(writer, {
    createId: () => "application-1",
  });

  await commands.submit(validInput);

  assert.deepEqual(Object.keys(commands), ["submit"]);
  assert.equal(Object.isFrozen(commands), true);
  assert.equal(applications[0].schoolName, "SMA Negeri 1 Jakarta");
});

test("malformed WhatsApp input is rejected instead of sanitized", async () => {
  const { applications, writer } = recordingWriter();
  const commands = createSimasApplicationCommands(writer);

  const result = await commands.submit({
    ...validInput,
    contactWhatsapp: "0812abc34567890",
  });

  assert.equal(result.ok, false);
  assert.deepEqual(applications, []);
});
