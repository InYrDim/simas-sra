import assert from "node:assert/strict";
import test from "node:test";

import { createStudentMasterDataService, type SchoolPerson, type StudentAudit, type StudentMasterDataStore, type StudentProfile } from "@/lib/student-master-data";
import type { MasterDataPrincipal } from "@/lib/tenant-master-data-access";

const principal: MasterDataPrincipal = { userId: "admin-1", tenantId: "tenant-1", role: "school-admin", capabilities: { read: true, write: true, downloadTemplate: true } };
const otherTenant = { ...principal, userId: "admin-2", tenantId: "tenant-2" };
const input = { fullName: "  Aisyah   Putri ", preferredName: "  Icha ", birthPlace: " Kota   Palu ", birthDate: "2012-03-04", gender: "female", nik: "0012.3456 7890-1234", nip: "", religion: "islam", street: " Jl.   Melati 1 ", village: "", district: "", city: "Palu", province: "Sulawesi Tengah", postalCode: "", phone: " +62 812-3456-7890 ", email: " AISYAH@EXAMPLE.COM ", nis: " 00042 ", nisn: "0012345678", externalStudentId: "", entryDate: "2024-07-15" };

function fixture() {
  const people: SchoolPerson[] = [], students: StudentProfile[] = [], audits: StudentAudit[] = [];
  const store: StudentMasterDataStore = {
    async listAvailablePeople(tenantId) { const profiled = new Set(students.filter((item) => item.tenantId === tenantId).map((item) => item.personId)); return people.filter((person) => person.tenantId === tenantId && !person.archived && !profiled.has(person.id)).map((person) => structuredClone(person)); },
    async list(tenantId) { return people.filter((person) => person.tenantId === tenantId).map((person) => ({ person: structuredClone(person), student: structuredClone(students.find((item) => item.tenantId === tenantId && item.personId === person.id)!), classGroupName: null })); },
    async transaction(tenantId, work) {
      const snapshots = [structuredClone(people), structuredClone(students), structuredClone(audits)] as const;
      try { return await work({
        async listPeople() { return people.filter((item) => item.tenantId === tenantId).map((item) => structuredClone(item)); },
        async listStudents() { return students.filter((item) => item.tenantId === tenantId).map((item) => structuredClone(item)); },
        async savePerson(value, expectedVersion) { assert.equal(value.tenantId, tenantId); const index = people.findIndex((item) => item.tenantId === tenantId && item.id === value.id); if (index < 0) people.push(structuredClone(value)); else { if (people[index].version !== expectedVersion) return false; people[index] = structuredClone(value); } return true; },
        async saveStudent(value, expectedVersion) { assert.equal(value.tenantId, tenantId); const index = students.findIndex((item) => item.tenantId === tenantId && item.id === value.id); if (index < 0) students.push(structuredClone(value)); else { if (students[index].version !== expectedVersion) return false; students[index] = structuredClone(value); } return true; },
        async appendAudit(value) { audits.push(structuredClone(value)); },
      }); } catch (error) { people.splice(0, people.length, ...snapshots[0]); students.splice(0, students.length, ...snapshots[1]); audits.splice(0, audits.length, ...snapshots[2]); throw error; }
    },
  };
  return { people, students, audits, store };
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

test("edits through optimistic versions and hides cross-Tenant records", async () => {
  const data = fixture(); const catalog = service(data.store); const first = await catalog.create(principal, input); assert.equal(first.ok, true); if (!first.ok) return;
  const edited = await catalog.edit(principal, first.record.student.id, { ...input, preferredName: "Aisyah", nis: "00099" }, 1, 1); assert.equal(edited.ok, true);
  assert.deepEqual(await catalog.edit(principal, first.record.student.id, input, 1, 1), { ok: false, code: "conflict" });
  assert.deepEqual(await catalog.edit(otherTenant, first.record.student.id, input, 2, 2), { ok: false, code: "not-found" });
  assert.equal(data.audits.at(-1)?.operation, "edited");
});
