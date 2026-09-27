import { and, asc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { academicSemester, attendanceSession, teachingAssignment, teachingPeriod, teachingSlot } from "@/db/schema";
import type {
  TeachingSlotAssignmentFacts,
  TeachingPeriodRecord,
  TeachingSlotRecord,
  TeachingSlotServiceStore,
} from "@/lib/academic/teaching-slot-service";

/**
 * Drizzle-backed store for the teaching slot service. Every query is
 * tenant-scoped; writes assert tenantId matching to keep cross-tenant
 * writes impossible even on a future caller mistake.
 */
export const teachingSlotStore: TeachingSlotServiceStore = {
  async assignmentsById(tenantId, ids) {
    if (ids.length === 0) return new Map();
    const rows = await db
      .select({
        id: teachingAssignment.id,
        teacherProfileId: teachingAssignment.teacherProfileId,
        classGroupId: teachingAssignment.classGroupId,
        academicYearId: teachingAssignment.academicYearId,
        status: teachingAssignment.status,
      })
      .from(teachingAssignment)
      .where(and(eq(teachingAssignment.tenantId, tenantId), inArray(teachingAssignment.id, [...ids])));
    return new Map(rows.map((row) => [row.id, row]));
  },

  async slotsInAcademicYear(tenantId, academicYearId) {
    return db
      .select({
        id: teachingSlot.id,
        tenantId: teachingSlot.tenantId,
        teachingAssignmentId: teachingSlot.teachingAssignmentId,
        dayOfWeek: teachingSlot.dayOfWeek,
        startTime: teachingSlot.startTime,
        endTime: teachingSlot.endTime,
        semester: teachingSlot.semester,
        version: teachingSlot.version,
        teacherProfileId: teachingAssignment.teacherProfileId,
        classGroupId: teachingAssignment.classGroupId,
      })
      .from(teachingSlot)
      .innerJoin(
        teachingAssignment,
        and(
          eq(teachingAssignment.tenantId, teachingSlot.tenantId),
          eq(teachingAssignment.id, teachingSlot.teachingAssignmentId),
        ),
      )
      .where(and(eq(teachingSlot.tenantId, tenantId), eq(teachingAssignment.academicYearId, academicYearId)));
  },

  async sessionCountsBySlotId(tenantId, slotIds) {
    // Delete guard (wayfinder 04): a slot that already owns attendance sessions
    // cannot be deleted. Tenant-scoped count over attendance_session.slot_id.
    if (slotIds.length === 0) return new Map();
    const rows = await db
      .select({ slotId: attendanceSession.slotId })
      .from(attendanceSession)
      .where(and(eq(attendanceSession.tenantId, tenantId), inArray(attendanceSession.slotId, [...slotIds])));
    const counts = new Map<string, number>();
    for (const row of rows) {
      if (row.slotId) counts.set(row.slotId, (counts.get(row.slotId) ?? 0) + 1);
    }
    return counts;
  },

  async activeSemester(tenantId, academicYearId) {
    const [row] = await db
      .select({ kind: academicSemester.kind })
      .from(academicSemester)
      .where(
        and(
          eq(academicSemester.tenantId, tenantId),
          eq(academicSemester.academicYearId, academicYearId),
          eq(academicSemester.status, "active"),
        ),
      )
      .limit(1);
    return row?.kind ?? null;
  },

  async insertSlot(tenantId, value) {
    if (value.tenantId !== tenantId) throw new Error("Cross-Tenant teaching slot write denied");
    await db.insert(teachingSlot).values({
      id: value.id,
      tenantId: value.tenantId,
      teachingAssignmentId: value.teachingAssignmentId,
      dayOfWeek: value.dayOfWeek,
      startTime: value.startTime,
      endTime: value.endTime,
      semester: value.semester,
      version: value.version,
    });
  },

  async updateSlot(tenantId, value, expectedVersion) {
    if (value.tenantId !== tenantId) throw new Error("Cross-Tenant teaching slot write denied");
    const result = await db
      .update(teachingSlot)
      .set({
        teachingAssignmentId: value.teachingAssignmentId,
        dayOfWeek: value.dayOfWeek,
        startTime: value.startTime,
        endTime: value.endTime,
        semester: value.semester,
        version: value.version,
        updatedAt: new Date(),
      })
      .where(and(eq(teachingSlot.tenantId, tenantId), eq(teachingSlot.id, value.id), eq(teachingSlot.version, expectedVersion)));
    return result.rowCount === 1;
  },

  async deleteSlot(tenantId, id) {
    const result = await db.delete(teachingSlot).where(and(eq(teachingSlot.tenantId, tenantId), eq(teachingSlot.id, id)));
    return result.rowCount === 1;
  },

  async listPeriods(tenantId) {
    return db
      .select({
        id: teachingPeriod.id,
        tenantId: teachingPeriod.tenantId,
        label: teachingPeriod.label,
        startTime: teachingPeriod.startTime,
        endTime: teachingPeriod.endTime,
        sortOrder: teachingPeriod.sortOrder,
        version: teachingPeriod.version,
      })
      .from(teachingPeriod)
      .where(eq(teachingPeriod.tenantId, tenantId))
      .orderBy(asc(teachingPeriod.sortOrder));
  },

  async insertPeriod(tenantId, value: TeachingPeriodRecord) {
    if (value.tenantId !== tenantId) throw new Error("Cross-Tenant teaching period write denied");
    await db.insert(teachingPeriod).values({
      id: value.id,
      tenantId: value.tenantId,
      label: value.label,
      startTime: value.startTime,
      endTime: value.endTime,
      sortOrder: value.sortOrder,
      version: value.version,
    });
  },

  async deletePeriod(tenantId, id) {
    const result = await db.delete(teachingPeriod).where(and(eq(teachingPeriod.tenantId, tenantId), eq(teachingPeriod.id, id)));
    return result.rowCount === 1;
  },
};

export type { TeachingSlotAssignmentFacts };
