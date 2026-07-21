import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { schoolPerson, schoolPersonAudit, staffProfile, studentProfile, teacherProfile, tenant, user } from "@/db/schema";
import type { SchoolPersonAggregate, SchoolPersonMasterDataStore, SchoolPersonSummary } from "@/lib/school-person-master-data";

async function getWith(executor: Pick<typeof db, "select">, tenantId: string, personId: string): Promise<SchoolPersonAggregate | null> {
  const [rows, students, teachers, staff] = await Promise.all([
    executor.select({ id: schoolPerson.id, tenantId: schoolPerson.tenantId, fullName: schoolPerson.fullName, nik: schoolPerson.nik, nip: schoolPerson.nip, accountUserId: schoolPerson.accountUserId, archived: schoolPerson.archived, version: schoolPerson.version, updatedAt: schoolPerson.updatedAt }).from(schoolPerson).where(and(eq(schoolPerson.tenantId, tenantId), eq(schoolPerson.id, personId))).limit(1),
    executor.select({ id: studentProfile.id, archived: studentProfile.archived }).from(studentProfile).where(and(eq(studentProfile.tenantId, tenantId), eq(studentProfile.personId, personId))),
    executor.select({ id: teacherProfile.id, archived: teacherProfile.archived }).from(teacherProfile).where(and(eq(teacherProfile.tenantId, tenantId), eq(teacherProfile.personId, personId))),
    executor.select({ id: staffProfile.id, archived: staffProfile.archived }).from(staffProfile).where(and(eq(staffProfile.tenantId, tenantId), eq(staffProfile.personId, personId))),
  ]);
  const person = rows[0]; if (!person) return null;
  return { person, profiles: [...students.map((item) => ({ ...item, kind: "student" as const })), ...teachers.map((item) => ({ ...item, kind: "teacher" as const })), ...staff.map((item) => ({ ...item, kind: "staff" as const }))] };
}

export const schoolPersonMasterDataStore: SchoolPersonMasterDataStore = {
  get: (tenantId, personId) => getWith(db, tenantId, personId),
  transaction(tenantId, work) { return db.transaction(async (tx) => { await tx.execute(sql`SELECT ${tenant.id} FROM ${tenant} WHERE ${tenant.id} = ${tenantId} FOR UPDATE`); return work({
    get: (personId) => getWith(tx, tenantId, personId),
    async savePerson(value: SchoolPersonSummary, expectedVersion: number) { if (value.tenantId !== tenantId) throw new Error("Cross-Tenant Warga Sekolah write denied"); const result = await tx.update(schoolPerson).set({ archived: value.archived, version: value.version, updatedAt: value.updatedAt }).where(and(eq(schoolPerson.tenantId, tenantId), eq(schoolPerson.id, value.id), eq(schoolPerson.version, expectedVersion))); return result[0].affectedRows === 1; },
    async appendAudit(value) { if (value.tenantId !== tenantId) throw new Error("Cross-Tenant Warga Sekolah audit denied"); const [actor] = await tx.select({ id: user.id }).from(user).where(and(eq(user.tenantId, tenantId), eq(user.id, value.actorUserId))).limit(1); if (!actor) throw new Error("Warga Sekolah audit actor is not a Tenant member"); await tx.insert(schoolPersonAudit).values({ ...value, affectedProfiles: [...value.affectedProfiles] }); },
  }); }); },
};
