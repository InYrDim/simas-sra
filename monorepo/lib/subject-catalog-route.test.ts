import assert from "node:assert/strict";
import test from "node:test";

import { parseSubjectForm, subjectResultCode } from "@/lib/subject-catalog-route";

test("route adapter parses only the Mata Pelajaran transport contract", () => {
  const form = new FormData();
  form.set("id", "subject-1"); form.set("version", "4"); form.set("code", "MAT-01"); form.set("name", "Matematika"); form.append("educationLevels", "SMA"); form.append("educationLevels", "SMP"); form.set("description", "Dasar"); form.set("ignoredTeacherId", "teacher-1");
  assert.deepEqual(parseSubjectForm(form), { id: "subject-1", version: 4, input: { code: "MAT-01", name: "Matematika", educationLevels: ["SMA", "SMP"], description: "Dasar" } });
});

test("route adapter rejects malformed identity/version and maps safe result codes", () => {
  const form = new FormData();
  form.set("version", "NaN");
  assert.equal(parseSubjectForm(form), null);
  assert.equal(subjectResultCode({ ok: false, code: "duplicate-code" }), "duplicate-code");
  assert.equal(subjectResultCode({ ok: false, code: "database-password-leaked" }), "error");
  assert.equal(subjectResultCode({ ok: true }), "saved");
});
