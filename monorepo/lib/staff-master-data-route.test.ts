import assert from "node:assert/strict";
import test from "node:test";
import { parseStaffForm, parseStaffLifecycleForm, staffResultCode } from "@/lib/staff-master-data-route";

test("parses only the staff transport contract and optimistic versions", () => {
  const form = new FormData(); for (const [key, value] of Object.entries({ fullName: "Aisyah Putri", birthPlace: "Palu", birthDate: "2012-01-01", gender: "female", street: "Jalan", staffNumber: "0001", position: "administration", serviceStartDate: "2024-07-01", employmentType: "civil-servant", assignmentStatus: "active", personVersion: "2", staffVersion: "3", id: "staff-1" })) form.set(key, value);
  const parsed = parseStaffForm(form); assert.equal(parsed?.id, "staff-1"); assert.equal(parsed?.personVersion, 2); assert.equal(parsed?.staffVersion, 3); assert.equal(parsed?.input.staffNumber, "0001");
  assert.equal(Object.hasOwn(parsed!.input, "tenantId"), false); assert.equal(Object.hasOwn(parsed!.input, "accountUserId"), false);
});

test("parses dedicated lifecycle, archive, and reactivation transport without trusting Tenant fields", () => {
  const form = new FormData(); for (const [key, value] of Object.entries({ id: "staff-1", expectedVersion: "2", operation: "transition", toStatus: "leave", effectiveDate: "2025-01-10", reason: "Cuti domisili", notes: "Catatan" , tenantId: "attacker" })) form.set(key, value);
  assert.deepEqual(parseStaffLifecycleForm(form), { id: "staff-1", expectedVersion: 2, operation: "transition", toStatus: "leave", effectiveDate: "2025-01-10", reason: "Cuti domisili", notes: "Catatan" });
  form.set("operation", "archive"); assert.deepEqual(parseStaffLifecycleForm(form), { id: "staff-1", expectedVersion: 2, operation: "archive", reason: "Cuti domisili" });
});

test("rejects malformed transport and maps only safe result codes", () => {
  assert.equal(parseStaffForm(new FormData()), null);
  assert.equal(staffResultCode({ ok: false, code: "duplicate-staffNumber" }), "duplicate-staffNumber");
  assert.equal(staffResultCode({ ok: false, code: "relationship-blocked" }), "relationship-blocked");
  assert.equal(staffResultCode({ ok: false, code: "database-secret" }), "error");
});
