import assert from "node:assert/strict";
import test from "node:test";

import { buildPpdbFormSteps } from "@/lib/ppdb-form-steps";
import type { PpdbFormField } from "@/lib/ppdb-session";

const fields: PpdbFormField[] = [
  { id: "birth-place", label: "Tempat Lahir", type: "text", required: true },
  { id: "birth-order", label: "Anak ke", type: "number", required: false },
  { id: "gender", label: "Jenis Kelamin", type: "select", required: true, options: ["Laki-laki", "Perempuan"] },
  { id: "address", label: "Alamat", type: "text", required: true },
  { id: "family-card", label: "Kartu Keluarga", type: "file", required: true },
];

test("builds every public form step exclusively from configured fields", () => {
  const steps = buildPpdbFormSteps(fields);

  assert.deepEqual(steps[0], { kind: "fields", title: "Informasi Pribadi (1/2)", fields: fields.slice(0, 3) });
  assert.deepEqual(steps[1], { kind: "fields", title: "Informasi Pribadi (2/2)", fields: [fields[3]] });
  assert.deepEqual(steps[2], { kind: "files", title: "Upload Dokumen", fields: [fields[4]] });
  assert.deepEqual(steps[3], { kind: "review", title: "Konfirmasi Pendaftaran" });
  assert.deepEqual(steps.flatMap((step) => "fields" in step ? step.fields : []), fields);
});
