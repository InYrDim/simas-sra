import assert from "node:assert/strict";
import test from "node:test";

import { createStudentMasterDataService, type SchoolPerson, type StudentAudit, type StudentLifecyclePeriod, type StudentMasterDataStore, type StudentProfile, type StudentRelationshipBlocker } from "@/lib/student-master-data";
import type { MasterDataPrincipal } from "@/lib/tenant-master-data-access";

const principal: MasterDataPrincipal = { userId: "admin-1", tenantId: "tenant-1", role: "school-admin", capabilities: { read: true, write: true, downloadTemplate: true } };
const otherTenant = { ...principal, userId: "admin-2", tenantId: "tenant-2" };
const input = { fullName: "  Aisyah   Putri ", preferredName: "  Icha ", birthPlace: " Kota   Palu ", birthDate: "2012-03-04", gender: "female", nik: "0012.3456 7890-1234", nip: "", religion: "islam", street: " Jl.   Melati 1 ", village: "", district: "", city: "Palu", province: "Sulawesi Tengah", postalCode: "", phone: " +62 812-3456-7890 ", email: " AISYAH@EXAMPLE.COM ", nis: " 00042 ", nisn: "0012345678", externalStudentId: "", entryDate: "2024-07-15" };

function fixture() {
  const people: SchoolPerson[] = [], students: StudentProfile[] = [], periods: StudentLifecyclePeriod[] = [], blockers: StudentRelationshipBlocker[] = [], audits: StudentAudit[] = [];
  const store: StudentMasterDataStore = {
    async listAvailablePeople(tenantId) { const profiled = new Set(students.filter((item) => item.tenantId === tenantId).map((item) => item.personId)); return people.filter((person) => person.tenantId === tenantId && !person.archived && !profiled.has(person.id)).map((person) => structuredClone(person)); },
    async list(tenantId) { return people.filter((person) => person.tenantId === tenantId).map((person) => ({ person: structuredClone(person), student: structuredClone(students.find((item) => item.tenantId === tenantId && item.personId === person.id)!), classGroupName: null })); },
    async transaction(tenantId, work) {
      const snapshots = [structuredClone(people), structuredClone(students), structuredClone(audits)] as const;
      try { return await work({
        async listPeople() { return people.filter((item) => item.tenantId === tenantId).map((item) => structuredClone(item)); },
        async listStudents() { return students.filter((item) => item.tenantId === tenantId).map((item) => structuredClone(item)); },
        async listLifecyclePeriods(studentId) { return periods.filter((item) => item.tenantId === tenantId && item.studentId === studentId).map((item) => structuredClone(item)); },
        async listRelationshipBlockers(studentId) { return blockers.filter((item) => item.tenantId === tenantId && item.studentId === studentId && item.active).map((item) => structuredClone(item)); },
        async appendLifecyclePeriod(value) { assert.equal(value.tenantId, tenantId); periods.push(structuredClone(value)); },
        async closeLifecyclePeriod(id, endedAt) { const period = periods.find((item) => item.tenantId === tenantId && item.id === id); if (!period || period.endedAt) return false; Object.assign(period, { endedAt }); return true; },
        async savePerson(value, expectedVersion) { assert.equal(value.tenantId, tenantId); const index = people.findIndex((item) => item.tenantId === tenantId && item.id === value.id); if (index < 0) people.push(structuredClone(value)); else { if (people[index].version !== expectedVersion) return false; people[index] = structuredClone(value); } return true; },
        async saveStudent(value, expectedVersion) { assert.equal(value.tenantId, tenantId); const index = students.findIndex((item) => item.tenantId === tenantId && item.id === value.id); if (index < 0) students.push(structuredClone(value)); else { if (students[index].version !== expectedVersion) return false; students[index] = structuredClone(value); } return true; },
        async appendAudit(value) { audits.push(structuredClone(value)); },
      }); } catch (error) { people.splice(0, people.length, ...snapshots[0]); students.splice(0, students.length, ...snapshots[1]); audits.splice(0, audits.length, ...snapshots[2]); throw error; }
    },
  };
  return { people, students, periods, blockers, audits, store };
}
function service(store: StudentMasterDataStore) { let n = 0; return createStudentMasterDataService({ store, id: () => `id-${++n}`, now: () => new Date("2026-07-20T09:00:00Z") }); }

test("creates normalized Warga Sekolah and active Siswa atomically without an account", async () => {
  const data = fixture(); const result = await service(data.store).create(principal, input);
  assert.equal(result.ok, true); if (!result.ok) return;
  assert.equal(result.record.person.fullName, "Aisyah Putri"); assert.equal(result.record.person.nik, "0012345678901234");
  assert.equal(result.record.person.nip, null); assert.equal(result.record.person.phone, "+6281234567890"); assert.equal(result.record.person.email, "aisyah@example.com");
  assert.equal(result.record.student.nis, "00042"); assert.equal(result.record.student.status, "active"); assert.equal(result.record.person.accountUserId, null);
  assert.deepEqual(data.audits.map((event) => event.operation), ["created-person", "created-student"]);
});

test("rejects invalid personal and textual identifiers without mutation", async () => {
  const data = fixture(); const catalog = service(data.store);
  for (const changed of [{ nik: "123" }, { nisn: "123" }, { email: "invalid" }, { fullName: "A" }, { birthDate: "2099-01-01" }]) assert.deepEqual(await catalog.create(principal, { ...input, ...changed }), { ok: false, code: "invalid-input" });
  assert.equal(data.people.length, 0); assert.equal(data.students.length, 0); assert.equal(data.audits.length, 0);
});

test("requires explicit compatible linking and rejects incompatible identifiers or an existing Siswa profile", async () => {
  const data = fixture(); const catalog = service(data.store); const first = await catalog.create(principal, input); assert.equal(first.ok, true); if (!first.ok) return;
  assert.deepEqual(await catalog.create(principal, { ...input, nis: "00043", nisn: "" }), { ok: false, code: "link-required", candidatePersonIds: [first.record.person.id] });
    assert.deepEqual(await catalog.create(principal, { ...input, fullName: "Orang Berbeda", nis: "00043", nisn: "" }), { ok: false, code: "identifier-conflict" });
    assert.deepEqual(await catalog.create(principal, { ...input, existingPersonId: first.record.person.id, nis: "00043", nisn: "" }), { ok: false, code: "duplicate-profile" });
  assert.deepEqual(await catalog.create(otherTenant, input).then((result) => result.ok), true);
});

test("attaches a Siswa profile only after explicitly selecting a compatible Warga Sekolah", async () => {
  const data = fixture(); const catalog = service(data.store); const timestamp = new Date("2026-07-20T09:00:00Z");
  data.people.push({ id: "existing-person", tenantId: principal.tenantId, fullName: "Aisyah Putri", normalizedName: "aisyah putri", preferredName: null, birthPlace: "Kota Palu", normalizedBirthPlace: "kota palu", birthDate: "2012-03-04", gender: "female", nik: "0012345678901234", nip: null, religion: null, street: "Jalan", village: null, district: null, city: null, province: null, postalCode: null, phone: null, email: null, accountUserId: null, accountActive: false, archived: false, version: 1, createdAt: timestamp, updatedAt: timestamp });
  const result = await catalog.create(principal, { ...input, existingPersonId: "existing-person", nisn: "" }); assert.equal(result.ok, true); if (!result.ok) return;
  assert.equal(data.people.length, 1); assert.equal(result.record.student.personId, "existing-person"); assert.equal(data.audits[0].operation, "attached-student");
});

test("warns on similar identity and never auto-merges", async () => {
  const data = fixture(); const catalog = service(data.store); const first = await catalog.create(principal, { ...input, nik: "", nis: "00042", nisn: "" }); assert.equal(first.ok, true);
  const warning = await catalog.create(principal, { ...input, nik: "", nis: "00043", nisn: "", email: "", phone: "", fullName: "Aisyah Putri" });
  assert.equal(warning.ok, false); if (warning.ok) return; assert.equal(warning.code, "possible-duplicate"); assert.equal(data.people.length, 1);
  assert.equal((await catalog.create(principal, { ...input, nik: "", nis: "00043", nisn: "", email: "", phone: "", confirmDistinct: true })).ok, true); assert.equal(data.people.length, 2);
});

test("appends effective-dated lifecycle periods and permits return from Pindah or Keluar", async () => {
  const data = fixture(); const catalog = service(data.store); const created = await catalog.create(principal, input); assert.equal(created.ok, true); if (!created.ok) return;
  assert.equal(data.periods.length, 1); assert.equal(data.periods[0].status, "active");
  assert.deepEqual(await catalog.transition(principal, created.record.student.id, { toStatus: "transferred", effectiveDate: "2025-01-10", reason: "Pindah domisili", expectedVersion: 1 }).then((r) => r.ok), true);
  assert.deepEqual(data.periods.map((period) => [period.status, period.startedAt, period.endedAt]), [["active", "2024-07-15", "2025-01-10"], ["transferred", "2025-01-10", null]]);
  assert.equal((await catalog.transition(principal, created.record.student.id, { toStatus: "active", effectiveDate: "2025-02-01", reason: "Diterima kembali", expectedVersion: 2 })).ok, true);
  assert.deepEqual(data.periods.map((period) => period.status), ["active", "transferred", "active"]);
});

test("rejects invalid, overlapping, future, and ordinary graduation reversal transitions without mutation", async () => {
  const data = fixture(); const catalog = service(data.store); const created = await catalog.create(principal, input); assert.equal(created.ok, true); if (!created.ok) return;
  assert.deepEqual(await catalog.transition(principal, created.record.student.id, { toStatus: "graduated", effectiveDate: "2024-01-01", reason: "Lulus", expectedVersion: 1 }), { ok: false, code: "invalid-effective-date" });
  assert.deepEqual(await catalog.transition(principal, created.record.student.id, { toStatus: "graduated", effectiveDate: "2027-01-01", reason: "Lulus", expectedVersion: 1 }), { ok: false, code: "future-transition" });
  assert.equal((await catalog.transition(principal, created.record.student.id, { toStatus: "graduated", effectiveDate: "2025-06-01", reason: "Lulus", expectedVersion: 1 })).ok, true);
  assert.deepEqual(await catalog.transition(principal, created.record.student.id, { toStatus: "active", effectiveDate: "2025-06-02", reason: "Salah", expectedVersion: 2 }), { ok: false, code: "graduation-correction-required" });
  assert.equal(data.periods.length, 2);
});

test("corrects graduation with required reason and before/after audit", async () => {
  const data = fixture(); const catalog = service(data.store); const created = await catalog.create(principal, input); assert.equal(created.ok, true); if (!created.ok) return;
  await catalog.transition(principal, created.record.student.id, { toStatus: "graduated", effectiveDate: "2025-06-01", reason: "Lulus", expectedVersion: 1 });
  const corrected = await catalog.correctGraduation(principal, created.record.student.id, { toStatus: "active", effectiveDate: "2025-06-01", reason: "Kelulusan tercatat pada profil yang salah", expectedVersion: 2 });
  assert.equal(corrected.ok, true); assert.equal(data.students[0].status, "active"); assert.equal(data.audits.at(-1)?.operation, "graduation-corrected");
  assert.deepEqual(data.audits.at(-1)?.lifecycleBefore, { status: "graduated", effectiveDate: "2025-06-01" });
  assert.deepEqual(data.audits.at(-1)?.lifecycleAfter, { status: "active", effectiveDate: "2025-06-01" });
});

test("enumerates archive blockers, warns for active accounts, and reactivates without restoring history", async () => {
  const data = fixture(); const catalog = service(data.store); const created = await catalog.create(principal, input); assert.equal(created.ok, true); if (!created.ok) return;
  data.people[0] = { ...data.people[0], accountUserId: "account-1", accountActive: true }; data.blockers.push({ id: "rel-1", tenantId: principal.tenantId, studentId: created.record.student.id, kind: "class-membership", label: "Rombongan Belajar 10A", active: true });
  assert.deepEqual(await catalog.archive(principal, created.record.student.id, { reason: "Arsip", expectedVersion: 1 }), { ok: false, code: "active-status" });
  await catalog.transition(principal, created.record.student.id, { toStatus: "transferred", effectiveDate: "2025-01-10", reason: "Pindah", expectedVersion: 1 });
  const denied = await catalog.archive(principal, created.record.student.id, { reason: "Arsip", expectedVersion: 2 }); assert.equal(denied.ok, false); if (denied.ok) return; assert.equal(denied.code, "relationship-blocked"); assert.equal("blockers" in denied, true); if (!("blockers" in denied)) return; assert.deepEqual((denied.blockers as StudentRelationshipBlocker[]).map((item) => item.label), ["Rombongan Belajar 10A"]);
  data.blockers.splice(0, 1, { ...data.blockers[0], active: false }); const archived = await catalog.archive(principal, created.record.student.id, { reason: "Arsip", expectedVersion: 2 }); assert.equal(archived.ok, true); if (!archived.ok) return; assert.deepEqual(archived.warnings, ["Akun Pengguna tertaut masih aktif."]);
  data.people[0] = { ...data.people[0], archived: true }; const historyCount = data.periods.length; const reactivated = await catalog.reactivate(principal, created.record.student.id, { reason: "Profil diperlukan kembali", expectedVersion: 3 }); assert.equal(reactivated.ok, true); assert.equal(data.students[0].status, "transferred"); assert.equal(data.periods.length, historyCount); assert.equal(data.people[0].archived, false); assert.equal(data.people[0].accountUserId, "account-1"); assert.equal(data.blockers[0].active, false);
});

test("lifecycle, archive, and reactivation hide cross-Tenant records", async () => {
  const data = fixture(); const catalog = service(data.store); const created = await catalog.create(principal, input); assert.equal(created.ok, true); if (!created.ok) return;
  assert.deepEqual(await catalog.transition(otherTenant, created.record.student.id, { toStatus: "withdrawn", effectiveDate: "2025-01-01", reason: "Keluar", expectedVersion: 1 }), { ok: false, code: "not-found" });
  assert.deepEqual(await catalog.archive(otherTenant, created.record.student.id, { reason: "Arsip", expectedVersion: 1 }), { ok: false, code: "not-found" });
  assert.deepEqual(await catalog.reactivate(otherTenant, created.record.student.id, { reason: "Aktifkan", expectedVersion: 1 }), { ok: false, code: "not-found" });
});

test("edits through optimistic versions and hides cross-Tenant records", async () => {
  const data = fixture(); const catalog = service(data.store); const first = await catalog.create(principal, input); assert.equal(first.ok, true); if (!first.ok) return;
  const edited = await catalog.edit(principal, first.record.student.id, { ...input, preferredName: "Aisyah", nis: "00099" }, 1, 1); assert.equal(edited.ok, true);
  assert.deepEqual(await catalog.edit(principal, first.record.student.id, input, 1, 1), { ok: false, code: "conflict" });
  assert.deepEqual(await catalog.edit(otherTenant, first.record.student.id, input, 2, 2), { ok: false, code: "not-found" });
  assert.equal(data.audits.at(-1)?.operation, "edited");
});
