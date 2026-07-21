import { and, asc, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { headmasterAssignment, headmasterAssignmentAudit, schoolPerson, teacherProfile, tenant, user } from "@/db/schema";
import type { HeadmasterAssignmentStore, HeadmasterTeacher } from "@/lib/headmaster-assignment";

const listWith = (executor: Pick<typeof db, "select">, tenantId: string) => executor.select({ id: headmasterAssignment.id, tenantId: headmasterAssignment.tenantId, teacherId: headmasterAssignment.teacherId, startedAt: headmasterAssignment.startedAt, endedAt: headmasterAssignment.endedAt, reason: headmasterAssignment.reason, createdByUserId: headmasterAssignment.createdByUserId, createdAt: headmasterAssignment.createdAt }).from(headmasterAssignment).where(eq(headmasterAssignment.tenantId, tenantId)).orderBy(asc(headmasterAssignment.startedAt), asc(headmasterAssignment.id));
async function teachersWith(executor: Pick<typeof db, "select">, tenantId: string): Promise<HeadmasterTeacher[]> {
  return executor.select({ id: teacherProfile.id, tenantId: teacherProfile.tenantId, name: schoolPerson.fullName, status: teacherProfile.status, archived: teacherProfile.archived }).from(teacherProfile).innerJoin(schoolPerson, and(eq(schoolPerson.tenantId, teacherProfile.tenantId), eq(schoolPerson.id, teacherProfile.personId))).where(eq(teacherProfile.tenantId, tenantId));
}

export const headmasterAssignmentStore: HeadmasterAssignmentStore = {
  list: (tenantId) => listWith(db, tenantId),
    listTeachers: (tenantId) => teachersWith(db, tenantId),
    async listEligibleTeachers(tenantId) { return (await teachersWith(db, tenantId)).filter((teacher) => teacher.status === "active" && !teacher.archived); },
  transaction(tenantId, work) { return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT ${tenant.id} FROM ${tenant} WHERE ${tenant.id} = ${tenantId} FOR UPDATE`);
    return work({
      listAssignments: () => listWith(tx, tenantId),
      async findTeacher(id) { const [teacher] = (await teachersWith(tx, tenantId)).filter((item) => item.id === id); return teacher ?? null; },
      async closeAssignment(id, endedAt) { const result = await tx.update(headmasterAssignment).set({ endedAt }).where(and(eq(headmasterAssignment.tenantId, tenantId), eq(headmasterAssignment.id, id), isNull(headmasterAssignment.endedAt))); return result[0].affectedRows === 1; },
      async appendAssignment(value) { if (value.tenantId !== tenantId) throw new Error("Cross-Tenant headmaster assignment denied"); await tx.insert(headmasterAssignment).values(value); },
      async appendAudit(value) { if (value.tenantId !== tenantId) throw new Error("Cross-Tenant headmaster audit denied"); const [actor] = await tx.select({ id: user.id }).from(user).where(and(eq(user.tenantId, tenantId), eq(user.id, value.actorUserId))).limit(1); if (!actor) throw new Error("Headmaster audit actor is not a Tenant member"); await tx.insert(headmasterAssignmentAudit).values(value); },
    });
  }); },
};
