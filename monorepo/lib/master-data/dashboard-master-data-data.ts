import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  academicYear,
  classGroup,
  studentProfile,
  subject,
  teacherProfile,
} from "@/db/schema";
import type { UrgentMasterDataPresence } from "@/lib/master-data/dashboard-master-data";

export async function getUrgentMasterDataPresence(
  tenantId: string,
): Promise<UrgentMasterDataPresence> {
  const [academicYears, students, teachers, subjects, classGroups] = await Promise.all([
    db
      .select({ id: academicYear.id })
      .from(academicYear)
      .where(
        and(
          eq(academicYear.tenantId, tenantId),
          eq(academicYear.lifecycle, "active"),
          eq(academicYear.archived, false),
        ),
      )
      .limit(1),
    db
      .select({ id: studentProfile.id })
      .from(studentProfile)
      .where(
        and(
          eq(studentProfile.tenantId, tenantId),
          eq(studentProfile.status, "active"),
          eq(studentProfile.archived, false),
        ),
      )
      .limit(1),
    db
      .select({ id: teacherProfile.id })
      .from(teacherProfile)
      .where(
        and(
          eq(teacherProfile.tenantId, tenantId),
          eq(teacherProfile.status, "active"),
          eq(teacherProfile.archived, false),
        ),
      )
      .limit(1),
    db
      .select({ id: subject.id })
      .from(subject)
      .where(and(eq(subject.tenantId, tenantId), eq(subject.archived, false)))
      .limit(1),
    db
      .select({ id: classGroup.id })
      .from(classGroup)
      .where(
        and(
          eq(classGroup.tenantId, tenantId),
          eq(classGroup.lifecycle, "active"),
          eq(classGroup.archived, false),
        ),
      )
      .limit(1),
  ]);

  return {
    academicYears: academicYears.length > 0,
    students: students.length > 0,
    teachers: teachers.length > 0,
    subjects: subjects.length > 0,
    classGroups: classGroups.length > 0,
  };
}
