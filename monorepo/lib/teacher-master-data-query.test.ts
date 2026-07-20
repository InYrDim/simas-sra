import assert from "node:assert/strict";
import test from "node:test";
import { queryTeachers } from "@/lib/teacher-master-data-query";
import type { TeacherRecord } from "@/lib/teacher-master-data";

const record = (id: string, name: string, teacherNumber: string, status: "active" | "ended" = "active", archived = false): TeacherRecord => ({ person: { id: `p-${id}`, tenantId: "tenant", fullName: name, normalizedName: name.toLowerCase(), preferredName: null, birthPlace: "Palu", normalizedBirthPlace: "palu", birthDate: "2012-01-01", gender: "female", nik: null, nip: null, religion: null, street: "Jalan", village: null, district: null, city: null, province: null, postalCode: null, phone: null, email: null, accountUserId: null, accountActive: false, archived: false, version: 1, createdAt: new Date(), updatedAt: new Date() }, teacher: { id, tenantId: "tenant", personId: `p-${id}`, teacherNumber, normalizedTeacherNumber: teacherNumber, nuptk: null, employmentType: "civil-servant", serviceStartDate: "2024-01-01", status, archived, version: 1, createdAt: new Date(), updatedAt: new Date() }, classGroupName: null });

test("normalizes URL search, lifecycle, archive, sort, pagination, and selected state", () => {
  const values = [record("2", "Budi", "00002", "ended", true), record("1", "Aisyah", "00001"), record("3", "Citra", "12-34")];
  const result = queryTeachers(values, { q: " 1234 ", status: "active", archive: "active", sort: "teacherNumber-desc", page: "99", pageSize: "25", selected: "3" });
  assert.equal(result.total, 1); assert.equal(result.items[0].teacher.id, "3"); assert.equal(result.query.page, 1); assert.equal(result.query.selected, "3");
});

test("distinguishes first-use empty and filtered zero results", () => {
  assert.equal(queryTeachers([], {}).state, "empty");
  assert.equal(queryTeachers([record("1", "Aisyah", "00001")], { q: "tidak ada" }).state, "no-results");
});
