import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { academicYear, classGroup, classMembership, classRelationshipEvent, homeroomAssignment, schoolPerson, studentProfile, teacherProfile, tenant } from "@/db/schema";
import type { ClassMembershipStore, RelationshipReferenceData } from "@/lib/class-membership";

async function referencesWith(executor: Pick<typeof db, "select">, tenantId: string): Promise<RelationshipReferenceData> {
  const [students, teachers, groups, years] = await Promise.all([
    executor.select({ id: studentProfile.id, tenantId: studentProfile.tenantId, name: schoolPerson.fullName, status: studentProfile.status, archived: studentProfile.archived }).from(studentProfile).innerJoin(schoolPerson, and(eq(schoolPerson.tenantId, studentProfile.tenantId), eq(schoolPerson.id, studentProfile.personId))).where(eq(studentProfile.tenantId, tenantId)),
    executor.select({ id: teacherProfile.id, tenantId: teacherProfile.tenantId, name: schoolPerson.fullName, status: teacherProfile.status, archived: teacherProfile.archived }).from(teacherProfile).innerJoin(schoolPerson, and(eq(schoolPerson.tenantId, teacherProfile.tenantId), eq(schoolPerson.id, teacherProfile.personId))).where(eq(teacherProfile.tenantId, tenantId)),
    executor.select({ id: classGroup.id, tenantId: classGroup.tenantId, academicYearId: classGroup.academicYearId, groupName: classGroup.groupName, grade: classGroup.grade, lifecycle: classGroup.lifecycle, archived: classGroup.archived }).from(classGroup).where(eq(classGroup.tenantId, tenantId)),
    executor.select({ id: academicYear.id, tenantId: academicYear.tenantId, lifecycle: academicYear.lifecycle, archived: academicYear.archived }).from(academicYear).where(eq(academicYear.tenantId, tenantId)),
  ]);
  return { students: students.map((x) => ({ id: x.id, tenantId: x.tenantId, name: x.name, active: x.status === "active", archived: x.archived })), teachers: teachers.map((x) => ({ id: x.id, tenantId: x.tenantId, name: x.name, active: x.status === "active", archived: x.archived })), groups: groups.map((x) => ({ id: x.id, tenantId: x.tenantId, academicYearId: x.academicYearId, name: `${x.grade} ${x.groupName}`, lifecycle: x.lifecycle, archived: x.archived })), years };
}
const membershipsWith = (executor: Pick<typeof db, "select">, tenantId: string) => executor.select().from(classMembership).where(eq(classMembership.tenantId, tenantId)).orderBy(asc(classMembership.startedAt), asc(classMembership.id));
const homeroomsWith = (executor: Pick<typeof db, "select">, tenantId: string) => executor.select().from(homeroomAssignment).where(eq(homeroomAssignment.tenantId, tenantId)).orderBy(asc(homeroomAssignment.startedAt), asc(homeroomAssignment.id));
export const classMembershipStore: ClassMembershipStore = {
  listMemberships: (tenantId) => membershipsWith(db, tenantId), listHomerooms: (tenantId) => homeroomsWith(db, tenantId), references: (tenantId) => referencesWith(db, tenantId),
  transaction(tenantId, work) { return db.transaction(async (tx) => { await tx.execute(sql`SELECT ${tenant.id} FROM ${tenant} WHERE ${tenant.id} = ${tenantId} FOR UPDATE`); return work({
    listMemberships: () => membershipsWith(tx, tenantId), listHomerooms: () => homeroomsWith(tx, tenantId), references: () => referencesWith(tx, tenantId),
    async appendMembership(value) { if (value.tenantId !== tenantId) throw new Error("Cross-Tenant membership write denied"); await tx.insert(classMembership).values(value); },
    async closeMembership(id, endedAt) { const result = await tx.update(classMembership).set({ endedAt }).where(and(eq(classMembership.tenantId, tenantId), eq(classMembership.id, id), isNull(classMembership.endedAt))); return result[0].affectedRows === 1; },
    async appendHomeroom(value) { if (value.tenantId !== tenantId) throw new Error("Cross-Tenant homeroom write denied"); await tx.insert(homeroomAssignment).values(value); },
    async closeHomeroom(id, endedAt) { const result = await tx.update(homeroomAssignment).set({ endedAt }).where(and(eq(homeroomAssignment.tenantId, tenantId), eq(homeroomAssignment.id, id), isNull(homeroomAssignment.endedAt))); return result[0].affectedRows === 1; },
    async appendEvent(value) { if (value.tenantId !== tenantId) throw new Error("Cross-Tenant relationship event denied"); await tx.insert(classRelationshipEvent).values(value); },
  }); }); },
};
