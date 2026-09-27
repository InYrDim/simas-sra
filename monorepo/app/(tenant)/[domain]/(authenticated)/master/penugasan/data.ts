import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { academicYear, classGroup, schoolPerson, subject, teacherProfile, teachingAssignment, teachingAssignmentEvent } from "@/db/schema";
import type { TeachingAssignmentStatus } from "@/lib/academic/teaching-assignment";
import { createHttpTenantAuthorizationEvaluator } from "@/lib/authorization/tenant-authorization-data";
import { enforceAuthorizedTenantOperation } from "@/lib/authorization/tenant-operation-route-access";

export type PenugasanListItem = {
  id: string;
  status: TeachingAssignmentStatus;
  teacherProfileId: string;
  subjectId: string;
  classGroupId: string;
  academicYearId: string;
  teacherName: string;
  subjectName: string;
  classGroupName: string;
  yearLabel: string;
  startsOn: string;
  endsOn: string | null;
  version: number;
};

export type PenugasanEventItem = {
  id: string;
  operation: string;
  reason: string;
  effectiveOn: string;
  occurredAt: string;
};

export type PenugasanOption = { value: string; label: string };

export type PenugasanPageState = {
  assignments: PenugasanListItem[];
  events: PenugasanEventItem[];
  selectedId: string | null;
  teachers: PenugasanOption[];
  subjects: PenugasanOption[];
  classGroups: PenugasanOption[];
  academicYears: PenugasanOption[];
  filters: { status: string; academicYearId: string };
};

const statusLabel: Record<TeachingAssignmentStatus, string> = {
  planned: "Direncanakan",
  active: "Aktif",
  ended: "Berakhir",
  cancelled: "Dibatalkan",
};

export async function loadPenugasanPageState(
  domain: string,
  params: { selected?: string; status?: string; academicYearId?: string },
): Promise<PenugasanPageState> {
  const evaluator = await createHttpTenantAuthorizationEvaluator();
  const operationId = "teaching-assignments.load";
  const result = await evaluator.evaluate({ surface: "page", domain, operationId });
  const principal = enforceAuthorizedTenantOperation(result, { domain, operationId });
  const tenantId = principal.tenantId;

  const [assignmentRows, teacherRows, subjectRows, groupRows, yearRows, eventRows] = await Promise.all([
    db.select().from(teachingAssignment).where(eq(teachingAssignment.tenantId, tenantId)),
    db
      .select({ id: teacherProfile.id, name: schoolPerson.fullName })
      .from(teacherProfile)
      .innerJoin(schoolPerson, and(eq(schoolPerson.tenantId, teacherProfile.tenantId), eq(schoolPerson.id, teacherProfile.personId)))
      .where(and(eq(teacherProfile.tenantId, tenantId), eq(teacherProfile.status, "active"), eq(teacherProfile.archived, false), eq(schoolPerson.archived, false)))
      .orderBy(asc(schoolPerson.fullName)),
    db
      .select({ id: subject.id, name: subject.name })
      .from(subject)
      .where(and(eq(subject.tenantId, tenantId), eq(subject.archived, false)))
      .orderBy(asc(subject.name)),
    db
      .select({ id: classGroup.id, name: classGroup.groupName })
      .from(classGroup)
      .where(and(eq(classGroup.tenantId, tenantId), eq(classGroup.archived, false)))
      .orderBy(asc(classGroup.groupName)),
    db
      .select({ id: academicYear.id, label: academicYear.label })
      .from(academicYear)
      .where(and(eq(academicYear.tenantId, tenantId), eq(academicYear.archived, false)))
      .orderBy(asc(academicYear.startDate)),
    db
      .select({
        id: teachingAssignmentEvent.id,
        assignmentId: teachingAssignmentEvent.teachingAssignmentId,
        operation: teachingAssignmentEvent.operation,
        reason: teachingAssignmentEvent.reason,
        effectiveOn: teachingAssignmentEvent.effectiveOn,
        occurredAt: teachingAssignmentEvent.occurredAt,
      })
      .from(teachingAssignmentEvent)
      .where(eq(teachingAssignmentEvent.tenantId, tenantId)),
  ]);

  const teacherNames = new Map(teacherRows.map((row) => [row.id, row.name]));
  const subjectNames = new Map(subjectRows.map((row) => [row.id, row.name]));
  const groupNames = new Map(groupRows.map((row) => [row.id, row.name]));
  const yearLabels = new Map(yearRows.map((row) => [row.id, row.label]));
  const selected = params.selected && assignmentRows.some((row) => row.id === params.selected) ? params.selected : null;

  const assignments: PenugasanListItem[] = assignmentRows
    .filter((row) => (params.status && params.status !== "all" ? row.status === params.status : true))
    .filter((row) => (params.academicYearId ? row.academicYearId === params.academicYearId : true))
    .map((row) => ({
      id: row.id,
      status: row.status,
      teacherProfileId: row.teacherProfileId,
      subjectId: row.subjectId,
      classGroupId: row.classGroupId,
      academicYearId: row.academicYearId,
      teacherName: teacherNames.get(row.teacherProfileId) ?? "(Guru tidak dikenal)",
      subjectName: subjectNames.get(row.subjectId) ?? "(Mapel tidak dikenal)",
      classGroupName: groupNames.get(row.classGroupId) ?? "(Rombel tidak dikenal)",
      yearLabel: yearLabels.get(row.academicYearId) ?? "(Tahun ajaran tidak dikenal)",
      startsOn: row.startsOn,
      endsOn: row.endsOn,
      version: row.version,
    }))
    .sort((left, right) => left.startsOn.localeCompare(right.startsOn) || left.teacherName.localeCompare(right.teacherName));

  const events: PenugasanEventItem[] = eventRows
    .filter((row) => (selected ? row.assignmentId === selected : false))
    .map((row) => ({
      id: row.id,
      operation: row.operation,
      reason: row.reason,
      effectiveOn: row.effectiveOn,
      occurredAt: row.occurredAt.toISOString(),
    }))
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));

  return {
    assignments,
    events,
    selectedId: selected,
    teachers: teacherRows.map((row) => ({ value: row.id, label: row.name })),
    subjects: subjectRows.map((row) => ({ value: row.id, label: row.name })),
    classGroups: groupRows.map((row) => ({ value: row.id, label: row.name })),
    academicYears: yearRows.map((row) => ({ value: row.id, label: row.label })),
    filters: {
      status: params.status ?? "all",
      academicYearId: params.academicYearId ?? "",
    },
  };
}


