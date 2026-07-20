import assert from "node:assert/strict";
import test from "node:test";
import { parseTeacherForm, parseTeacherLifecycleForm, teacherResultCode } from "@/lib/teacher-master-data-route";

test("parses only the teacher transport contract and optimistic versions", () => {
  const form = new FormData(); for (const [key, value] of Object.entries({ fullName: "Aisyah Putri", birthPlace: "Palu", birthDate: "2012-01-01", gender: "female", street: "Jalan", teacherNumber: "0001", serviceStartDate: "2024-07-01", employmentType: "civil-servant", assignmentStatus: "active", personVersion: "2", teacherVersion: "3", id: "teacher-1" })) form.set(key, value);
  const parsed = parseTeacherForm(form); assert.equal(parsed?.id, "teacher-1"); assert.equal(parsed?.personVersion, 2); assert.equal(parsed?.teacherVersion, 3); assert.equal(parsed?.input.teacherNumber, "0001");
  assert.equal(Object.hasOwn(parsed!.input, "tenantId"), false); assert.equal(Object.hasOwn(parsed!.input, "accountUserId"), false);
});

test("parses dedicated lifecycle, archive, and reactivation transport without trusting Tenant fields", () => {
  const form = new FormData(); for (const [key, value] of Object.entries({ id: "teacher-1", expectedVersion: "2", operation: "transition", toStatus: "leave", effectiveDate: "2025-01-10", reason: "Cuti domisili", notes: "Catatan" , tenantId: "attacker" })) form.set(key, value);
  assert.deepEqual(parseTeacherLifecycleForm(form), { id: "teacher-1", expectedVersion: 2, operation: "transition", toStatus: "leave", effectiveDate: "2025-01-10", reason: "Cuti domisili", notes: "Catatan" });
  form.set("operation", "archive"); assert.deepEqual(parseTeacherLifecycleForm(form), { id: "teacher-1", expectedVersion: 2, operation: "archive", reason: "Cuti domisili" });
});

test("rejects malformed transport and maps only safe result codes", () => {
  assert.equal(parseTeacherForm(new FormData()), null);
  assert.equal(teacherResultCode({ ok: false, code: "duplicate-teacherNumber" }), "duplicate-teacherNumber");
  assert.equal(teacherResultCode({ ok: false, code: "relationship-blocked" }), "relationship-blocked");
  assert.equal(teacherResultCode({ ok: false, code: "database-secret" }), "error");
});
