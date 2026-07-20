import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { schoolPerson, studentAudit, studentProfile, tenant, user } from "@/db/schema";
import type { SchoolPerson, StudentMasterDataStore, StudentRecord } from "@/lib/student-master-data";

async function listWith(executor: Pick<typeof db, "select">, tenantId: string): Promise<StudentRecord[]> {
  const rows = await executor.select({ person: schoolPerson, student: studentProfile, accountEnabled: user.emailVerified }).from(studentProfile).innerJoin(schoolPerson, and(eq(schoolPerson.tenantId, studentProfile.tenantId), eq(schoolPerson.id, studentProfile.personId))).leftJoin(user, and(eq(user.tenantId, tenantId), eq(user.id, schoolPerson.accountUserId))).where(eq(studentProfile.tenantId, tenantId)).orderBy(asc(schoolPerson.normalizedName), asc(studentProfile.id));
  return rows.map(({ person, student, accountEnabled }) => ({ person: { ...person, accountActive: Boolean(accountEnabled) }, student, classGroupName: null }));
}
async function peopleWith(executor: Pick<typeof db, "select">, tenantId: string): Promise<SchoolPerson[]> { const rows = await executor.select({ person: schoolPerson, accountEnabled: user.emailVerified }).from(schoolPerson).leftJoin(user, and(eq(user.tenantId, tenantId), eq(user.id, schoolPerson.accountUserId))).where(eq(schoolPerson.tenantId, tenantId)); return rows.map(({ person, accountEnabled }) => ({ ...person, accountActive: Boolean(accountEnabled) })); }
export const studentMasterDataStore: StudentMasterDataStore = {
  list: (tenantId) => listWith(db, tenantId),
  async listAvailablePeople(tenantId) { const people = await peopleWith(db, tenantId), students = await db.select({ personId: studentProfile.personId }).from(studentProfile).where(eq(studentProfile.tenantId, tenantId)), profiled = new Set(students.map((item) => item.personId)); return people.filter((person) => !person.archived && !profiled.has(person.id)); },
  transaction(tenantId, work) { return db.transaction(async (tx) => { await tx.execute(sql`SELECT ${tenant.id} FROM ${tenant} WHERE ${tenant.id} = ${tenantId} FOR UPDATE`); return work({
    listPeople: () => peopleWith(tx, tenantId),
    async listStudents() { return tx.select().from(studentProfile).where(eq(studentProfile.tenantId, tenantId)); },
    async savePerson(value, expectedVersion) { if (value.tenantId !== tenantId) throw new Error("Cross-Tenant person write denied"); const { accountActive, ...persisted } = value; void accountActive; if (expectedVersion === null) { await tx.insert(schoolPerson).values(persisted); return true; } const result = await tx.update(schoolPerson).set(persisted).where(and(eq(schoolPerson.tenantId, tenantId), eq(schoolPerson.id, value.id), eq(schoolPerson.version, expectedVersion))); return result[0].affectedRows === 1; },
    async saveStudent(value, expectedVersion) { if (value.tenantId !== tenantId) throw new Error("Cross-Tenant student write denied"); if (expectedVersion === null) { await tx.insert(studentProfile).values(value); return true; } const result = await tx.update(studentProfile).set(value).where(and(eq(studentProfile.tenantId, tenantId), eq(studentProfile.id, value.id), eq(studentProfile.version, expectedVersion))); return result[0].affectedRows === 1; },
    async appendAudit(value) { if (value.tenantId !== tenantId) throw new Error("Cross-Tenant audit write denied"); const [actor] = await tx.select({ id: user.id }).from(user).where(and(eq(user.id, value.actorUserId), eq(user.tenantId, tenantId))).limit(1); if (!actor) throw new Error("Student audit actor is not a Tenant member"); await tx.insert(studentAudit).values(value); },
  }); }); },
};
