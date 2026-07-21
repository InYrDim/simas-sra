import assert from "node:assert/strict";
import test from "node:test";
import { queryStudents } from "@/lib/student-master-data-query";
import type { StudentRecord } from "@/lib/student-master-data";

const record = (id: string, name: string, nis: string, status: "active" | "graduated" = "active", archived = false): StudentRecord => ({ person: { id: `p-${id}`, tenantId: "tenant", fullName: name, normalizedName: name.toLowerCase(), preferredName: null, birthPlace: "Palu", normalizedBirthPlace: "palu", birthDate: "2012-01-01", gender: "female", nik: null, nip: null, religion: null, street: "Jalan", village: null, district: null, city: null, province: null, postalCode: null, phone: null, email: null, accountUserId: null, accountActive: false, archived: false, version: 1, createdAt: new Date(), updatedAt: new Date() }, student: { id, tenantId: "tenant", personId: `p-${id}`, nis, normalizedNis: nis, nisn: null, externalStudentId: null, entryDate: "2024-01-01", status, archived, version: 1, createdAt: new Date(), updatedAt: new Date() }, classGroupName: null });

test("normalizes URL search, lifecycle, archive, sort, pagination, and selected state", () => {
  const values = [record("2", "Budi", "00002", "graduated", true), record("1", "Aisyah", "00001"), record("3", "Citra", "12-34")];
  const result = queryStudents(values, { q: " 1234 ", status: "active", archive: "active", sort: "nis-desc", page: "99", pageSize: "25", selected: "3" });
  assert.equal(result.total, 1); assert.equal(result.items[0].student.id, "3"); assert.equal(result.query.page, 1); assert.equal(result.query.selected, "3");
});

test("distinguishes first-use empty and filtered zero results", () => {
  assert.equal(queryStudents([], {}).state, "empty");
  assert.equal(queryStudents([record("1", "Aisyah", "00001")], { q: "tidak ada" }).state, "no-results");
});
