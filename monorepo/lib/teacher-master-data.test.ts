import assert from "node:assert/strict";
import test from "node:test";

import { createTeacherMasterDataService, type SchoolPerson, type TeacherAudit, type TeacherLifecyclePeriod, type TeacherMasterDataStore, type TeacherProfile, type TeacherRelationshipBlocker } from "@/lib/teacher-master-data";
import type { MasterDataPrincipal } from "@/lib/tenant-master-data-access";

const principal: MasterDataPrincipal = { userId: "admin-1", tenantId: "tenant-1", role: "school-admin", capabilities: { read: true, write: true, downloadTemplate: true } };
const otherTenant = { ...principal, userId: "admin-2", tenantId: "tenant-2" };
const input = { fullName: "  Aisyah   Putri ", preferredName: "  Icha ", birthPlace: " Kota   Palu ", birthDate: "2012-03-04", gender: "female", nik: "0012.3456 7890-1234", nip: "", religion: "islam", street: " Jl.   Melati 1 ", village: "", district: "", city: "Palu", province: "Sulawesi Tengah", postalCode: "", phone: " +62 812-3456-7890 ", email: " AISYAH@EXAMPLE.COM ", teacherNumber: " 00042 ", nuptk: "0012345678901234", employmentType: "civil-servant", assignmentStatus: "active", serviceStartDate: "2024-07-15" };

function fixture() {
  const people: SchoolPerson[] = [], teachers: TeacherProfile[] = [], periods: TeacherLifecyclePeriod[] = [], blockers: TeacherRelationshipBlocker[] = [], audits: TeacherAudit[] = [];
  const store: TeacherMasterDataStore = {
    async listAvailablePeople(tenantId) { const profiled = new Set(teachers.filter((item) => item.tenantId === tenantId).map((item) => item.personId)); return people.filter((person) => person.tenantId === tenantId && !person.archived && !profiled.has(person.id)).map((person) => structuredClone(person)); },
    async list(tenantId) { return people.filter((person) => person.tenantId === tenantId).map((person) => ({ person: structuredClone(person), teacher: structuredClone(teachers.find((item) => item.tenantId === tenantId && item.personId === person.id)!), classGroupName: null })); },
    async transaction(tenantId, work) {
      const snapshots = [structuredClone(people), structuredClone(teachers), structuredClone(audits)] as const;
      try { return await work({
        async listPeople() { return people.filter((item) => item.tenantId === tenantId).map((item) => structuredClone(item)); },
        async listTeachers() { return teachers.filter((item) => item.tenantId === tenantId).map((item) => structuredClone(item)); },
        async listLifecyclePeriods(teacherId) { return periods.filter((item) => item.tenantId === tenantId && item.teacherId === teacherId).map((item) => structuredClone(item)); },
        async listRelationshipBlockers(teacherId) { return blockers.filter((item) => item.tenantId === tenantId && item.teacherId === teacherId && item.active).map((item) => structuredClone(item)); },
        async appendLifecyclePeriod(value) { assert.equal(value.tenantId, tenantId); periods.push(structuredClone(value)); },
        async closeLifecyclePeriod(id, endedAt) { const period = periods.find((item) => item.tenantId === tenantId && item.id === id); if (!period || period.endedAt) return false; Object.assign(period, { endedAt }); return true; },
        async savePerson(value, expectedVersion) { assert.equal(value.tenantId, tenantId); const index = people.findIndex((item) => item.tenantId === tenantId && item.id === value.id); if (index < 0) people.push(structuredClone(value)); else { if (people[index].version !== expectedVersion) return false; people[index] = structuredClone(value); } return true; },
        async saveTeacher(value, expectedVersion) { assert.equal(value.tenantId, tenantId); const index = teachers.findIndex((item) => item.tenantId === tenantId && item.id === value.id); if (index < 0) teachers.push(structuredClone(value)); else { if (teachers[index].version !== expectedVersion) return false; teachers[index] = structuredClone(value); } return true; },
        async appendAudit(value) { audits.push(structuredClone(value)); },
      }); } catch (error) { people.splice(0, people.length, ...snapshots[0]); teachers.splice(0, teachers.length, ...snapshots[1]); audits.splice(0, audits.length, ...snapshots[2]); throw error; }
    },
  };
  return { people, teachers, periods, blockers, audits, store };
}
function service(store: TeacherMasterDataStore) { let n = 0; return createTeacherMasterDataService({ store, id: () => `id-${++n}`, now: () => new Date("2026-07-20T09:00:00Z") }); }

test("creates normalized Warga Sekolah and active Guru atomically without an account", async () => {
  const data = fixture(); const result = await service(data.store).create(principal, input);
  assert.equal(result.ok, true); if (!result.ok) return;
  assert.equal(result.record.person.fullName, "Aisyah Putri"); assert.equal(result.record.person.nik, "0012345678901234");
  assert.equal(result.record.person.nip, null); assert.equal(result.record.person.phone, "+6281234567890"); assert.equal(result.record.person.email, "aisyah@example.com");
  assert.equal(result.record.teacher.teacherNumber, "00042"); assert.equal(result.record.teacher.status, "active"); assert.equal(result.record.person.accountUserId, null);
  assert.deepEqual(data.audits.map((event) => event.operation), ["created-person", "created-teacher"]);
});

test("rejects invalid personal and textual identifiers without mutation", async () => {
  const data = fixture(); const catalog = service(data.store);
  for (const changed of [{ nik: "123" }, { nuptk: "123" }, { email: "invalid" }, { fullName: "A" }, { birthDate: "2099-01-01" }]) assert.deepEqual(await catalog.create(principal, { ...input, ...changed }), { ok: false, code: "invalid-input" });
  assert.equal(data.people.length, 0); assert.equal(data.teachers.length, 0); assert.equal(data.audits.length, 0);
});

test("requires explicit compatible linking and rejects incompatible identifiers or an existing Guru profile", async () => {
  const data = fixture(); const catalog = service(data.store); const first = await catalog.create(principal, input); assert.equal(first.ok, true); if (!first.ok) return;
  assert.deepEqual(await catalog.create(principal, { ...input, teacherNumber: "00043", nuptk: "" }), { ok: false, code: "link-required", candidatePersonIds: [first.record.person.id] });
    assert.deepEqual(await catalog.create(principal, { ...input, fullName: "Orang Berbeda", teacherNumber: "00043", nuptk: "" }), { ok: false, code: "identifier-conflict" });
    assert.deepEqual(await catalog.create(principal, { ...input, existingPersonId: first.record.person.id, teacherNumber: "00043", nuptk: "" }), { ok: false, code: "duplicate-profile" });
  assert.deepEqual(await catalog.create(otherTenant, input).then((result) => result.ok), true);
});

test("attaches a Guru profile only after explicitly selecting a compatible Warga Sekolah", async () => {
  const data = fixture(); const catalog = service(data.store); const timestamp = new Date("2026-07-20T09:00:00Z");
  data.people.push({ id: "existing-person", tenantId: principal.tenantId, fullName: "Aisyah Putri", normalizedName: "aisyah putri", preferredName: null, birthPlace: "Kota Palu", normalizedBirthPlace: "kota palu", birthDate: "2012-03-04", gender: "female", nik: "0012345678901234", nip: null, religion: null, street: "Jalan", village: null, district: null, city: null, province: null, postalCode: null, phone: null, email: null, accountUserId: null, accountActive: false, archived: false, version: 1, createdAt: timestamp, updatedAt: timestamp });
  const result = await catalog.create(principal, { ...input, existingPersonId: "existing-person", nuptk: "" }); assert.equal(result.ok, true); if (!result.ok) return;
  assert.equal(data.people.length, 1); assert.equal(result.record.teacher.personId, "existing-person"); assert.equal(data.audits[0].operation, "attached-teacher");
});

test("warns on similar identity and never auto-merges", async () => {
  const data = fixture(); const catalog = service(data.store); const first = await catalog.create(principal, { ...input, nik: "", teacherNumber: "00042", nuptk: "" }); assert.equal(first.ok, true);
  const warning = await catalog.create(principal, { ...input, nik: "", teacherNumber: "00043", nuptk: "", email: "", phone: "", fullName: "Aisyah Putri" });
  assert.equal(warning.ok, false); if (warning.ok) return; assert.equal(warning.code, "possible-duplicate"); assert.equal(data.people.length, 1);
  assert.equal((await catalog.create(principal, { ...input, nik: "", teacherNumber: "00043", nuptk: "", email: "", phone: "", confirmDistinct: true })).ok, true); assert.equal(data.people.length, 2);
});

test("appends effective-dated lifecycle periods and permits return from Cuti or Berakhir", async () => {
  const data = fixture(); const catalog = service(data.store); const created = await catalog.create(principal, input); assert.equal(created.ok, true); if (!created.ok) return;
  assert.equal(data.periods.length, 1); assert.equal(data.periods[0].status, "active");
  assert.deepEqual(await catalog.transition(principal, created.record.teacher.id, { toStatus: "leave", effectiveDate: "2025-01-10", reason: "Cuti domisili", expectedVersion: 1 }).then((r) => r.ok), true);
  assert.deepEqual(data.periods.map((period) => [period.status, period.startedAt, period.endedAt]), [["active", "2024-07-15", "2025-01-10"], ["leave", "2025-01-10", null]]);
  assert.equal((await catalog.transition(principal, created.record.teacher.id, { toStatus: "active", effectiveDate: "2025-02-01", reason: "Diterima kembali", expectedVersion: 2 })).ok, true);
  assert.deepEqual(data.periods.map((period) => period.status), ["active", "leave", "active"]);
});

test("rejects invalid, overlapping, and future transitions and opens a new service period on return", async () => {
  const data = fixture(); const catalog = service(data.store); const created = await catalog.create(principal, input); assert.equal(created.ok, true); if (!created.ok) return;
  assert.deepEqual(await catalog.transition(principal, created.record.teacher.id, { toStatus: "ended", effectiveDate: "2024-01-01", reason: "Berakhir", expectedVersion: 1 }), { ok: false, code: "invalid-effective-date" });
  assert.deepEqual(await catalog.transition(principal, created.record.teacher.id, { toStatus: "ended", effectiveDate: "2027-01-01", reason: "Berakhir", expectedVersion: 1 }), { ok: false, code: "future-transition" });
  assert.equal((await catalog.transition(principal, created.record.teacher.id, { toStatus: "ended", effectiveDate: "2025-06-01", reason: "Berakhir", expectedVersion: 1 })).ok, true);
  assert.equal((await catalog.transition(principal, created.record.teacher.id, { toStatus: "active", effectiveDate: "2025-06-02", reason: "Diangkat kembali", expectedVersion: 2 })).ok, true);
  assert.deepEqual(data.periods.map((period) => period.status), ["active", "ended", "active"]);
});

test("corrects service with required reason and before/after audit", async () => {
  const data = fixture(); const catalog = service(data.store); const created = await catalog.create(principal, input); assert.equal(created.ok, true); if (!created.ok) return;
  await catalog.transition(principal, created.record.teacher.id, { toStatus: "ended", effectiveDate: "2025-06-01", reason: "Berakhir", expectedVersion: 1 });
  const corrected = await catalog.correctService(principal, created.record.teacher.id, { toStatus: "active", effectiveDate: "2025-06-01", reason: "Masa kerja tercatat pada profil yang salah", expectedVersion: 2 });
  assert.equal(corrected.ok, true); assert.equal(data.teachers[0].status, "active"); assert.equal(data.audits.at(-1)?.operation, "service-corrected");
  assert.deepEqual(data.audits.at(-1)?.lifecycleBefore, { status: "ended", effectiveDate: "2025-06-01" });
  assert.deepEqual(data.audits.at(-1)?.lifecycleAfter, { status: "active", effectiveDate: "2025-06-01" });
});

test("enumerates archive blockers, warns for active accounts, and reactivates without restoring history", async () => {
  const data = fixture(); const catalog = service(data.store); const created = await catalog.create(principal, input); assert.equal(created.ok, true); if (!created.ok) return;
  data.people[0] = { ...data.people[0], accountUserId: "account-1", accountActive: true }; data.blockers.push({ id: "rel-1", tenantId: principal.tenantId, teacherId: created.record.teacher.id, kind: "class-membership", label: "Rombongan Belajar 10A", active: true });
  assert.deepEqual(await catalog.archive(principal, created.record.teacher.id, { reason: "Arsip", expectedVersion: 1 }), { ok: false, code: "active-status" });
  await catalog.transition(principal, created.record.teacher.id, { toStatus: "ended", effectiveDate: "2025-01-10", reason: "Kontrak berakhir", expectedVersion: 1 });
  const denied = await catalog.archive(principal, created.record.teacher.id, { reason: "Arsip", expectedVersion: 2 }); assert.equal(denied.ok, false); if (denied.ok) return; assert.equal(denied.code, "relationship-blocked"); assert.equal("blockers" in denied, true); if (!("blockers" in denied)) return; assert.deepEqual((denied.blockers as TeacherRelationshipBlocker[]).map((item) => item.label), ["Rombongan Belajar 10A"]);
  data.blockers.splice(0, 1, { ...data.blockers[0], active: false }); const archived = await catalog.archive(principal, created.record.teacher.id, { reason: "Arsip", expectedVersion: 2 }); assert.equal(archived.ok, true); if (!archived.ok) return; assert.deepEqual(archived.warnings, ["Akun Pengguna tertaut masih aktif."]);
  data.people[0] = { ...data.people[0], archived: true }; const historyCount = data.periods.length; const reactivated = await catalog.reactivate(principal, created.record.teacher.id, { reason: "Profil diperlukan kembali", expectedVersion: 3 }); assert.equal(reactivated.ok, true); assert.equal(data.teachers[0].status, "ended"); assert.equal(data.periods.length, historyCount); assert.equal(data.people[0].archived, false); assert.equal(data.people[0].accountUserId, "account-1"); assert.equal(data.blockers[0].active, false);
});

test("lifecycle, archive, and reactivation hide cross-Tenant records", async () => {
  const data = fixture(); const catalog = service(data.store); const created = await catalog.create(principal, input); assert.equal(created.ok, true); if (!created.ok) return;
  assert.deepEqual(await catalog.transition(otherTenant, created.record.teacher.id, { toStatus: "ended", effectiveDate: "2025-01-01", reason: "Berakhir", expectedVersion: 1 }), { ok: false, code: "not-found" });
  assert.deepEqual(await catalog.archive(otherTenant, created.record.teacher.id, { reason: "Arsip", expectedVersion: 1 }), { ok: false, code: "not-found" });
  assert.deepEqual(await catalog.reactivate(otherTenant, created.record.teacher.id, { reason: "Aktifkan", expectedVersion: 1 }), { ok: false, code: "not-found" });
});

test("edits through optimistic versions and hides cross-Tenant records", async () => {
  const data = fixture(); const catalog = service(data.store); const first = await catalog.create(principal, input); assert.equal(first.ok, true); if (!first.ok) return;
  const edited = await catalog.edit(principal, first.record.teacher.id, { ...input, preferredName: "Aisyah", teacherNumber: "00099" }, 1, 1); assert.equal(edited.ok, true);
  assert.deepEqual(await catalog.edit(principal, first.record.teacher.id, input, 1, 1), { ok: false, code: "conflict" });
  assert.deepEqual(await catalog.edit(otherTenant, first.record.teacher.id, input, 2, 2), { ok: false, code: "not-found" });
  assert.equal(data.audits.at(-1)?.operation, "edited");
});
