import assert from "node:assert/strict";
import test from "node:test";
import { parseStudentForm, studentResultCode } from "@/lib/student-master-data-route";

test("parses only the student transport contract and optimistic versions", () => {
  const form = new FormData(); for (const [key, value] of Object.entries({ fullName: "Aisyah Putri", birthPlace: "Palu", birthDate: "2012-01-01", gender: "female", street: "Jalan", nis: "0001", entryDate: "2024-07-01", personVersion: "2", studentVersion: "3", id: "student-1" })) form.set(key, value);
  const parsed = parseStudentForm(form); assert.equal(parsed?.id, "student-1"); assert.equal(parsed?.personVersion, 2); assert.equal(parsed?.studentVersion, 3); assert.equal(parsed?.input.nis, "0001");
  assert.equal(Object.hasOwn(parsed!.input, "tenantId"), false); assert.equal(Object.hasOwn(parsed!.input, "accountUserId"), false);
});

test("rejects malformed transport and maps only safe result codes", () => {
  assert.equal(parseStudentForm(new FormData()), null);
  assert.equal(studentResultCode({ ok: false, code: "duplicate-nis" }), "duplicate-nis");
  assert.equal(studentResultCode({ ok: false, code: "database-secret" }), "error");
});
