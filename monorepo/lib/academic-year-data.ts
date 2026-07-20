import { and, asc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { academicSemester, academicYear, academicYearHistory, tenant, user } from "@/db/schema";
import type { AcademicYear, AcademicYearStore } from "@/lib/academic-year";

async function listWith(executor: Pick<typeof db, "select">, tenantId: string): Promise<AcademicYear[]> {
  const years = await executor.select().from(academicYear).where(eq(academicYear.tenantId, tenantId)).orderBy(asc(academicYear.startDate));
  if (!years.length) return [];
  const semesters = await executor.select().from(academicSemester).where(and(eq(academicSemester.tenantId, tenantId), inArray(academicSemester.academicYearId, years.map((year) => year.id)))).orderBy(asc(academicSemester.startDate));
  return years.map((year) => ({
    id: year.id, tenantId: year.tenantId, label: year.label, startDate: year.startDate, endDate: year.endDate,
    lifecycle: year.lifecycle, archived: year.archived, version: year.version, createdAt: year.createdAt, updatedAt: year.updatedAt,
    semesters: semesters.filter((semester) => semester.academicYearId === year.id).map((semester) => ({ id: semester.id, kind: semester.kind, startDate: semester.startDate, endDate: semester.endDate, status: semester.status })),
  }));
}

export const academicYearStore: AcademicYearStore = {
  list(tenantId) { return listWith(db, tenantId); },
  transaction(tenantId, work) {
    return db.transaction(async (transaction) => {
      await transaction.execute(sql`SELECT ${tenant.id} FROM ${tenant} WHERE ${tenant.id} = ${tenantId} FOR UPDATE`);
      return work({
        list: () => listWith(transaction, tenantId),
        async save(year) {
          if (year.tenantId !== tenantId) throw new Error("Cross-Tenant academic year write denied");
          const [existing] = await transaction.select({ id: academicYear.id }).from(academicYear).where(and(eq(academicYear.tenantId, tenantId), eq(academicYear.id, year.id))).limit(1);
          if (!existing) {
            await transaction.insert(academicYear).values({ id: year.id, tenantId, label: year.label, startDate: year.startDate, endDate: year.endDate, lifecycle: year.lifecycle, archived: year.archived, version: year.version, createdAt: year.createdAt, updatedAt: year.updatedAt });
            await transaction.insert(academicSemester).values(year.semesters.map((semester) => ({ ...semester, tenantId, academicYearId: year.id })));
            return;
          }
          const result = await transaction.update(academicYear).set({ lifecycle: year.lifecycle, archived: year.archived, version: year.version, updatedAt: year.updatedAt }).where(and(eq(academicYear.tenantId, tenantId), eq(academicYear.id, year.id)));
          if (result[0].affectedRows !== 1) throw new Error("Academic year not found");
          for (const semester of year.semesters) {
            const updated = await transaction.update(academicSemester).set({ status: semester.status }).where(and(eq(academicSemester.tenantId, tenantId), eq(academicSemester.id, semester.id), eq(academicSemester.academicYearId, year.id)));
            if (updated[0].affectedRows !== 1) throw new Error("Academic semester not found");
          }
        },
        async appendHistory(event) {
                  if (event.tenantId !== tenantId) throw new Error("Cross-Tenant academic history write denied");
                  const [actor] = await transaction.select({ id: user.id }).from(user).where(and(eq(user.id, event.actorUserId), eq(user.tenantId, tenantId))).limit(1);
                  if (!actor) throw new Error("Academic history actor is not a Tenant member");
                  await transaction.insert(academicYearHistory).values(event);
                },
      });
    });
  },
};
