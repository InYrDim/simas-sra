import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { academicYear, classGroup, subject, teacherProfile, teachingAssignment, teachingAssignmentEvent, tenant, user } from "@/db/schema";
import type { TeachingAssignmentEndpoint, TeachingAssignmentStore } from "@/lib/academic/teaching-assignment";

const levels = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);

async function endpoints(executor: Pick<typeof db, "select">, tenantId: string, input: { teacherProfileId: string; subjectId: string; classGroupId: string; academicYearId: string }): Promise<TeachingAssignmentEndpoint> {
  const [[teacher], [subjectRow], [group], [year]] = await Promise.all([
    executor.select({ id: teacherProfile.id, tenantId: teacherProfile.tenantId, active: sql<boolean>`${teacherProfile.status} IN ('active', 'leave')`, archived: teacherProfile.archived }).from(teacherProfile).where(and(eq(teacherProfile.tenantId, tenantId), eq(teacherProfile.id, input.teacherProfileId))).limit(1),
    executor.select({ id: subject.id, tenantId: subject.tenantId, archived: subject.archived, educationLevels: subject.educationLevels }).from(subject).where(and(eq(subject.tenantId, tenantId), eq(subject.id, input.subjectId))).limit(1),
    executor.select({ id: classGroup.id, tenantId: classGroup.tenantId, academicYearId: classGroup.academicYearId, educationLevel: classGroup.educationLevel, lifecycle: classGroup.lifecycle, archived: classGroup.archived }).from(classGroup).where(and(eq(classGroup.tenantId, tenantId), eq(classGroup.id, input.classGroupId))).limit(1),
    executor.select({ id: academicYear.id, tenantId: academicYear.tenantId, startDate: academicYear.startDate, endDate: academicYear.endDate, lifecycle: academicYear.lifecycle, archived: academicYear.archived }).from(academicYear).where(and(eq(academicYear.tenantId, tenantId), eq(academicYear.id, input.academicYearId))).limit(1),
  ]);
  return {
    teacher: teacher ? { ...teacher, active: Boolean(teacher.active) } : null,
    subject: subjectRow ? { ...subjectRow, educationLevels: levels(subjectRow.educationLevels) } : null,
    classGroup: group ?? null,
    academicYear: year ?? null,
  };
}

export const teachingAssignmentStore: TeachingAssignmentStore = {
  async actor(tenantId, userId) {
    const [row] = await db.select({ id: user.id }).from(user).where(and(eq(user.tenantId, tenantId), eq(user.id, userId))).limit(1);
    return Boolean(row);
  },
  async list(tenantId) { return db.select().from(teachingAssignment).where(eq(teachingAssignment.tenantId, tenantId)); },
  endpoints: (tenantId, input) => endpoints(db, tenantId, input),
  transaction(tenantId, work) {
    return db.transaction(async (tx) => {
      await tx.execute(sql`SELECT ${tenant.id} FROM ${tenant} WHERE ${tenant.id} = ${tenantId} FOR UPDATE`);
      const transaction = {
        list: () => tx.select().from(teachingAssignment).where(eq(teachingAssignment.tenantId, tenantId)),
        endpoints: (input: Parameters<TeachingAssignmentStore["endpoints"]>[1]) => endpoints(tx, tenantId, input),
        async insert(value: Parameters<typeof teachingAssignmentStore["transaction"]> extends never ? never : any) { await tx.insert(teachingAssignment).values(value); },
        async update(value: any, expectedVersion: number) { const result = await tx.update(teachingAssignment).set({ teacherProfileId: value.teacherProfileId, subjectId: value.subjectId, classGroupId: value.classGroupId, academicYearId: value.academicYearId, startsOn: value.startsOn, endsOn: value.endsOn, status: value.status, reason: value.reason, version: value.version, updatedAt: value.updatedAt }).where(and(eq(teachingAssignment.tenantId, tenantId), eq(teachingAssignment.id, value.id), eq(teachingAssignment.version, expectedVersion))); return result[0].affectedRows === 1; },
        async audit(value: any) { if (value.tenantId !== tenantId) throw new Error("Cross-Tenant teaching assignment audit denied"); await tx.insert(teachingAssignmentEvent).values(value); },
        async lockScope(tuple: { teacherProfileId: string; subjectId: string; classGroupId: string; academicYearId: string }) { await tx.execute(sql`SELECT ${teachingAssignment.id} FROM ${teachingAssignment} WHERE ${teachingAssignment.tenantId} = ${tenantId} AND ${teachingAssignment.teacherProfileId} = ${tuple.teacherProfileId} AND ${teachingAssignment.subjectId} = ${tuple.subjectId} AND ${teachingAssignment.classGroupId} = ${tuple.classGroupId} AND ${teachingAssignment.academicYearId} = ${tuple.academicYearId} FOR UPDATE`); },
      };
      return work(transaction);
    });
  },
};
