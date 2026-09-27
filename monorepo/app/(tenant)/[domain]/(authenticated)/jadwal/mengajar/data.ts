import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { academicSemester, academicYear, classGroup, schoolPerson, subject, teacherProfile, teachingAssignment, teachingPeriod, teachingSlot } from "@/db/schema";
import type { TeachingSlotDayOfWeek, TeachingSlotSemester } from "@/lib/academic/teaching-slot";
import { createHttpTenantAuthorizationEvaluator } from "@/lib/authorization/tenant-authorization-data";
import { enforceAuthorizedTenantOperation } from "@/lib/authorization/tenant-operation-route-access";
import { enforceTenantFeatureEnabled } from "@/lib/features/tenant-feature-route-access";

export type JadwalOption = { value: string; label: string };

export type JadwalClassGroup = { id: string; label: string };

export type JadwalAssignmentOption = {
  id: string;
  classGroupId: string;
  academicYearId: string;
  label: string;
};

export type JadwalSlotItem = {
  id: string;
  teachingAssignmentId: string;
  dayOfWeek: TeachingSlotDayOfWeek;
  startTime: string;
  endTime: string;
  semester: TeachingSlotSemester;
  subjectName: string;
  teacherName: string;
  assignmentLabel: string;
  version: number;
};

export type JadwalPeriodItem = {
  id: string;
  label: string;
  startTime: string;
  endTime: string;
  sortOrder: number;
};

export type JadwalPageState = {
  classGroups: JadwalClassGroup[];
  selectedClassGroupId: string | null;
  slots: JadwalSlotItem[];
  assignments: JadwalAssignmentOption[];
  periods: JadwalPeriodItem[];
  activeSemester: TeachingSlotSemester | null;
};

const DAY_ORDER: readonly TeachingSlotDayOfWeek[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

export const dayLabel: Record<TeachingSlotDayOfWeek, string> = {
  monday: "Senin",
  tuesday: "Selasa",
  wednesday: "Rabu",
  thursday: "Kamis",
  friday: "Jumat",
  saturday: "Sabtu",
  sunday: "Minggu",
};

export const semesterLabel: Record<TeachingSlotSemester, string> = {
  odd: "Ganjil",
  even: "Genap",
};

export async function loadJadwalMengajarState(
  domain: string,
  params: { classGroupId?: string },
): Promise<JadwalPageState> {
  await enforceTenantFeatureEnabled(domain, "penjadwalanRead");
  const evaluator = await createHttpTenantAuthorizationEvaluator();
  const operationId = "jadwal.mengajar.load";
  const result = await evaluator.evaluate({ surface: "page", domain, operationId });
  const principal = enforceAuthorizedTenantOperation(result, { domain, operationId });
  const tenantId = principal.tenantId;

  const groupRows = await db
    .select({ id: classGroup.id, label: classGroup.groupName, academicYearId: classGroup.academicYearId })
    .from(classGroup)
    .where(and(eq(classGroup.tenantId, tenantId), eq(classGroup.archived, false)))
    .orderBy(asc(classGroup.groupName));

  const selectedClassGroupId = params.classGroupId && groupRows.some((row) => row.id === params.classGroupId)
    ? params.classGroupId
    : null;

  const periods = await db
    .select({
      id: teachingPeriod.id,
      label: teachingPeriod.label,
      startTime: teachingPeriod.startTime,
      endTime: teachingPeriod.endTime,
      sortOrder: teachingPeriod.sortOrder,
    })
    .from(teachingPeriod)
    .where(eq(teachingPeriod.tenantId, tenantId))
    .orderBy(asc(teachingPeriod.sortOrder));

  if (!selectedClassGroupId) {
    return { classGroups: groupRows, selectedClassGroupId, slots: [], assignments: [], periods, activeSemester: null };
  }

  const selectedGroup = groupRows.find((row) => row.id === selectedClassGroupId)!;

  const [slotRows, assignmentRows, semesterRows] = await Promise.all([
    db
      .select({
        id: teachingSlot.id,
        dayOfWeek: teachingSlot.dayOfWeek,
        startTime: teachingSlot.startTime,
        endTime: teachingSlot.endTime,
        semester: teachingSlot.semester,
        version: teachingSlot.version,
        teachingAssignmentId: teachingSlot.teachingAssignmentId,
        subjectName: subject.name,
        teacherName: schoolPerson.fullName,
      })
      .from(teachingSlot)
      .innerJoin(
        teachingAssignment,
        and(
          eq(teachingAssignment.tenantId, teachingSlot.tenantId),
          eq(teachingAssignment.id, teachingSlot.teachingAssignmentId),
        ),
      )
      .innerJoin(subject, and(eq(subject.tenantId, teachingAssignment.tenantId), eq(subject.id, teachingAssignment.subjectId)))
      .innerJoin(teacherProfile, and(eq(teacherProfile.tenantId, teachingAssignment.tenantId), eq(teacherProfile.id, teachingAssignment.teacherProfileId)))
      .innerJoin(schoolPerson, and(eq(schoolPerson.tenantId, teacherProfile.tenantId), eq(schoolPerson.id, teacherProfile.personId)))
      .where(
        and(
          eq(teachingSlot.tenantId, tenantId),
          eq(teachingAssignment.classGroupId, selectedClassGroupId),
          eq(teachingAssignment.academicYearId, selectedGroup.academicYearId),
        ),
      ),
    db
      .select({
        id: teachingAssignment.id,
        classGroupId: teachingAssignment.classGroupId,
        academicYearId: teachingAssignment.academicYearId,
        subjectName: subject.name,
        teacherName: schoolPerson.fullName,
        yearLabel: academicYear.label,
      })
      .from(teachingAssignment)
      .innerJoin(subject, and(eq(subject.tenantId, teachingAssignment.tenantId), eq(subject.id, teachingAssignment.subjectId)))
      .innerJoin(teacherProfile, and(eq(teacherProfile.tenantId, teachingAssignment.tenantId), eq(teacherProfile.id, teachingAssignment.teacherProfileId)))
      .innerJoin(schoolPerson, and(eq(schoolPerson.tenantId, teacherProfile.tenantId), eq(schoolPerson.id, teacherProfile.personId)))
      .innerJoin(academicYear, and(eq(academicYear.tenantId, teachingAssignment.tenantId), eq(academicYear.id, teachingAssignment.academicYearId)))
      .where(and(eq(teachingAssignment.tenantId, tenantId), eq(teachingAssignment.status, "active")))
      .orderBy(asc(subject.name)),
    db
      .select({ kind: academicSemester.kind })
      .from(academicSemester)
      .where(
        and(
          eq(academicSemester.tenantId, tenantId),
          eq(academicSemester.academicYearId, selectedGroup.academicYearId),
          eq(academicSemester.status, "active"),
        ),
      )
      .limit(1),
  ]);

  const activeSemester = semesterRows[0]?.kind ?? null;

  const slots: JadwalSlotItem[] = slotRows
    .map((row) => ({
      id: row.id,
      teachingAssignmentId: row.teachingAssignmentId,
      dayOfWeek: row.dayOfWeek,
      startTime: row.startTime,
      endTime: row.endTime,
      semester: row.semester,
      subjectName: row.subjectName,
      teacherName: row.teacherName,
      assignmentLabel: `${row.subjectName} · ${row.teacherName}`,
      version: row.version,
    }))
    .sort(
      (left, right) =>
        DAY_ORDER.indexOf(left.dayOfWeek) - DAY_ORDER.indexOf(right.dayOfWeek) ||
        left.startTime.localeCompare(right.startTime),
    );

  const assignments: JadwalAssignmentOption[] = assignmentRows
    .filter((row) => row.classGroupId === selectedClassGroupId && row.academicYearId === selectedGroup.academicYearId)
    .map((row) => ({
      id: row.id,
      classGroupId: row.classGroupId,
      academicYearId: row.academicYearId,
      label: `${row.subjectName} — ${row.teacherName} (${row.yearLabel})`,
    }));

  return { classGroups: groupRows, selectedClassGroupId, slots, assignments, periods, activeSemester };
}
