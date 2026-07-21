import assert from "node:assert/strict";
import test from "node:test";

import { createHeadmasterAssignmentService, type HeadmasterAssignment, type HeadmasterAssignmentAudit, type HeadmasterAssignmentStore, type HeadmasterTeacher } from "@/lib/headmaster-assignment";
import type { MasterDataPrincipal } from "@/lib/tenant-master-data-access";

const principal: MasterDataPrincipal = { userId: "admin-1", tenantId: "tenant-1", role: "school-admin", capabilities: { read: true, write: true, downloadTemplate: true } };
const teachers: HeadmasterTeacher[] = [
  { id: "teacher-1", tenantId: "tenant-1", name: "Ibu Aminah", status: "active", archived: false },
  { id: "teacher-2", tenantId: "tenant-1", name: "Bapak Budi", status: "active", archived: false },
  { id: "teacher-ended", tenantId: "tenant-1", name: "Ibu Citra", status: "ended", archived: false },
  { id: "teacher-archived", tenantId: "tenant-1", name: "Bapak Dedi", status: "active", archived: true },
  { id: "teacher-other", tenantId: "tenant-2", name: "Ibu Eka", status: "active", archived: false },
];

function fixture(options: { failAudit?: boolean } = {}) {
  let assignments: HeadmasterAssignment[] = [];
  const audits: HeadmasterAssignmentAudit[] = [];
  const store: HeadmasterAssignmentStore = {
    async list(tenantId) { return assignments.filter((item) => item.tenantId === tenantId); },
        async listTeachers(tenantId) { return teachers.filter((item) => item.tenantId === tenantId); },
        async listEligibleTeachers(tenantId) { return teachers.filter((item) => item.tenantId === tenantId && item.status === "active" && !item.archived); },
    async transaction(tenantId, work) {
      const before = assignments.map((item) => ({ ...item }));
      const auditCount = audits.length;
      try {
        return await work({
          async listAssignments() { return assignments.filter((item) => item.tenantId === tenantId); },
          async findTeacher(id) { return teachers.find((item) => item.id === id && item.tenantId === tenantId) ?? null; },
          async closeAssignment(id, endedAt) { const current = assignments.find((item) => item.id === id && item.tenantId === tenantId && item.endedAt === null); if (!current) return false; assignments = assignments.map((item) => item === current ? { ...item, endedAt } : item); return true; },
          async appendAssignment(value) { if (value.tenantId !== tenantId) throw new Error("cross-Tenant"); assignments.push(value); },
          async appendAudit(value) { if (options.failAudit) throw new Error("audit unavailable"); audits.push(value); },
        });
      } catch (error) { assignments = before; audits.splice(auditCount); throw error; }
    },
  };
  return { store, assignments: () => assignments, audits };
}

const serviceFor = (store: HeadmasterAssignmentStore) => {
  const ids = ["assignment-1", "audit-1", "assignment-2", "audit-2"];
  return createHeadmasterAssignmentService({ store, id: () => ids.shift()!, now: () => new Date("2026-07-20T10:00:00Z") });
};

test("School Admin assigns an active same-Tenant Guru and records audit", async () => {
  const data = fixture(), service = serviceFor(data.store);
  const result = await service.assign(principal, { teacherId: "teacher-1", effectiveDate: "2025-07-01", reason: "Penetapan" });
  assert.equal(result.ok, true);
  assert.equal((await service.getProfile(principal)).current?.teacherName, "Ibu Aminah");
  assert.deepEqual(data.audits.map((item) => item.operation), ["assigned"]);
});

test("replacement closes the previous assignment and preserves effective-dated history", async () => {
  const data = fixture(), service = serviceFor(data.store);
  assert.equal((await service.assign(principal, { teacherId: "teacher-1", effectiveDate: "2025-07-01", reason: "Penetapan" })).ok, true);
  assert.equal((await service.assign(principal, { teacherId: "teacher-2", effectiveDate: "2026-01-01", reason: "Pergantian" })).ok, true);
  const profile = await service.getProfile(principal);
  assert.equal(profile.current?.teacherId, "teacher-2");
  assert.deepEqual(profile.history.map((item) => [item.teacherId, item.startedAt, item.endedAt]), [["teacher-2", "2026-01-01", null], ["teacher-1", "2025-07-01", "2026-01-01"]]);
  assert.deepEqual(data.audits.map((item) => item.operation), ["assigned", "replaced"]);
});

test("assignment rejects overlap, invalid dates, ineligible Guru, cross-Tenant ids, and read-only principals", async () => {
  const data = fixture(), service = serviceFor(data.store);
  assert.equal((await service.assign(principal, { teacherId: "teacher-1", effectiveDate: "2025-07-01", reason: "Penetapan" })).ok, true);
  assert.deepEqual(await service.assign(principal, { teacherId: "teacher-2", effectiveDate: "2025-06-30", reason: "Mundur" }), { ok: false, code: "overlap" });
  assert.deepEqual(await service.assign(principal, { teacherId: "teacher-2", effectiveDate: "not-a-date", reason: "Salah" }), { ok: false, code: "invalid-input" });
  assert.deepEqual(await service.assign(principal, { teacherId: "teacher-ended", effectiveDate: "2026-01-01", reason: "Salah" }), { ok: false, code: "invalid-teacher" });
  assert.deepEqual(await service.assign(principal, { teacherId: "teacher-archived", effectiveDate: "2026-01-01", reason: "Salah" }), { ok: false, code: "invalid-teacher" });
  assert.deepEqual(await service.assign(principal, { teacherId: "teacher-other", effectiveDate: "2026-01-01", reason: "Salah" }), { ok: false, code: "invalid-teacher" });
  assert.deepEqual(await service.assign({ ...principal, capabilities: { ...principal.capabilities, write: false } }, { teacherId: "teacher-2", effectiveDate: "2026-01-01", reason: "Salah" }), { ok: false, code: "read-only" });
});

test("audit failure rolls the assignment back", async () => {
  const data = fixture({ failAudit: true }), service = serviceFor(data.store);
  await assert.rejects(service.assign(principal, { teacherId: "teacher-1", effectiveDate: "2025-07-01", reason: "Penetapan" }), /audit unavailable/);
  assert.deepEqual(data.assignments(), []);
});
