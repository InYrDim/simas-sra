import "server-only";

import { createHash } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  academicSemester,
  academicYear,
  classGroup,
  schoolPerson,
  studentLifecyclePeriod,
  studentProfile,
  subject,
  teacherProfile,
  teacherServicePeriod,
} from "@/db/schema";
import {
  DEMO_MASTER_DATA_TYPES,
  demoAcademicPeriod,
  demoGrade,
  type DemoEducationLevel,
} from "@/lib/master-data/demo-master-data";
import type { MasterDataPrincipal } from "@/lib/master-data/tenant-master-data-access";

function deterministicId(tenantId: string, key: string) {
  const hex = createHash("sha256")
    .update(`${tenantId}:demo-master-data:${key}`)
    .digest("hex")
    .slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("id-ID").replace(/\s+/g, " ");
}



export async function importDemoMasterData(
  principal: MasterDataPrincipal,
  educationLevel: DemoEducationLevel,
  now = new Date(),
) {
  const tenantId = principal.tenantId;
  const id = (key: string) => deterministicId(tenantId, key);
  const period = demoAcademicPeriod(now);
  const yearId = id("academic-year");
  const teacherPersonId = id("person:teacher-1");
  const teacherId = id("teacher:1");
  const students = [
    { key: "student-1", name: "Andi Saputra", gender: "male" as const, birthDate: "2012-03-12", nis: "DEMO-001", nisn: "0099000001" },
    { key: "student-2", name: "Siti Rahma", gender: "female" as const, birthDate: "2012-08-21", nis: "DEMO-002", nisn: "0099000002" },
  ];
  const subjects = [
    { key: "subject-math", code: "DEMO-MAT", name: "Matematika Demo" },
    { key: "subject-language", code: "DEMO-BIN", name: "Bahasa Indonesia Demo" },
    { key: "subject-science", code: "DEMO-IPA", name: "Ilmu Pengetahuan Alam Demo" },
  ];

  await db.transaction(async (tx) => {
    const [activeYear] = await tx
      .select({ id: academicYear.id })
      .from(academicYear)
      .where(and(eq(academicYear.tenantId, tenantId), eq(academicYear.lifecycle, "active"), eq(academicYear.archived, false)))
      .limit(1);
    const selectedYearId = activeYear?.id ?? yearId;

    if (!activeYear) {
      await tx.insert(academicYear).values({
        id: yearId,
        tenantId,
        label: period.label,
        startDate: period.startDate,
        endDate: period.endDate,
        lifecycle: "active",
        archived: false,
        version: 1,
        createdAt: now,
        updatedAt: now,
      }).onDuplicateKeyUpdate({ set: { lifecycle: "active", archived: false, updatedAt: now } });
      await tx.insert(academicSemester).values([
        { id: id("semester:odd"), tenantId, academicYearId: yearId, kind: "odd", startDate: period.startDate, endDate: period.oddEndDate, status: "active" },
        { id: id("semester:even"), tenantId, academicYearId: yearId, kind: "even", startDate: period.evenStartDate, endDate: period.endDate, status: "pending" },
      ]).onDuplicateKeyUpdate({ set: { academicYearId: yearId } });
    }

    await tx.insert(schoolPerson).values({
      id: teacherPersonId,
      tenantId,
      fullName: "Budi Santoso",
      normalizedName: normalize("Budi Santoso"),
      birthPlace: "Jakarta",
      normalizedBirthPlace: "jakarta",
      birthDate: "1985-05-10",
      gender: "male",
      street: "Alamat Demo",
      email: "guru.demo@example.test",
      archived: false,
      version: 1,
      createdAt: now,
      updatedAt: now,
    }).onDuplicateKeyUpdate({ set: { archived: false, updatedAt: now } });
    await tx.insert(teacherProfile).values({
      id: teacherId,
      tenantId,
      personId: teacherPersonId,
      teacherNumber: "DEMO-GURU-001",
      normalizedTeacherNumber: "demo-guru-001",
      employmentType: "honorary",
      serviceStartDate: period.startDate,
      status: "active",
      archived: false,
      version: 1,
      createdAt: now,
      updatedAt: now,
    }).onDuplicateKeyUpdate({ set: { status: "active", archived: false, updatedAt: now } });
    await tx.insert(teacherServicePeriod).values({
      id: id("teacher-period:1"), tenantId, teacherId, status: "active", startedAt: period.startDate,
      reason: "Import data demo", corrected: false, createdByUserId: principal.userId, createdAt: now,
    }).onDuplicateKeyUpdate({ set: { status: "active", reason: "Import data demo" } });

    for (const student of students) {
      const personId = id(`person:${student.key}`);
      const profileId = id(`student:${student.key}`);
      await tx.insert(schoolPerson).values({
        id: personId, tenantId, fullName: student.name, normalizedName: normalize(student.name),
        birthPlace: "Jakarta", normalizedBirthPlace: "jakarta", birthDate: student.birthDate,
        gender: student.gender, street: "Alamat Demo", archived: false, version: 1,
        createdAt: now, updatedAt: now,
      }).onDuplicateKeyUpdate({ set: { archived: false, updatedAt: now } });
      await tx.insert(studentProfile).values({
        id: profileId, tenantId, personId, nis: student.nis, normalizedNis: normalize(student.nis),
        nisn: student.nisn, entryDate: period.startDate, status: "active", archived: false,
        version: 1, createdAt: now, updatedAt: now,
      }).onDuplicateKeyUpdate({ set: { status: "active", archived: false, updatedAt: now } });
      await tx.insert(studentLifecyclePeriod).values({
        id: id(`student-period:${student.key}`), tenantId, studentId: profileId, status: "active",
        startedAt: period.startDate, reason: "Import data demo", corrected: false,
        createdByUserId: principal.userId, createdAt: now,
      }).onDuplicateKeyUpdate({ set: { status: "active", reason: "Import data demo" } });
    }

    await tx.insert(subject).values(subjects.map((item) => ({
      id: id(item.key), tenantId, code: item.code, normalizedCode: normalize(item.code),
      name: item.name, normalizedName: normalize(item.name), educationLevels: educationLevel,
      description: "Data demo untuk mencoba fitur akademik", archived: false, version: 1,
      createdAt: now, updatedAt: now,
    }))).onDuplicateKeyUpdate({ set: { archived: false, updatedAt: now } });

    await tx.insert(classGroup).values({
      id: id("class-group:1"), tenantId, academicYearId: selectedYearId, educationLevel,
      grade: demoGrade(educationLevel), groupName: "A Demo", normalizedGroupName: "a demo",
      code: "DEMO-A", normalizedCode: "demo-a", capacity: 32, lifecycle: "active",
      archived: false, version: 1, createdAt: now, updatedAt: now,
    }).onDuplicateKeyUpdate({ set: { academicYearId: selectedYearId, lifecycle: "active", archived: false, updatedAt: now } });
  });

  return { imported: DEMO_MASTER_DATA_TYPES } as const;
}

export async function cleanDemoMasterData(principal: MasterDataPrincipal, now = new Date()) {
  const tenantId = principal.tenantId;
  const id = (key: string) => deterministicId(tenantId, key);
  const yearId = id("academic-year");
  const teacherPersonId = id("person:teacher-1");
  const teacherId = id("teacher:1");
  const studentPersonIds = ["student-1", "student-2"].map((key) => id(`person:${key}`));
  const studentProfileIds = ["student-1", "student-2"].map((key) => id(`student:${key}`));
  const subjectIds = ["subject-math", "subject-language", "subject-science"].map((key) => id(key));
  const classGroupId = id("class-group:1");

  await db.transaction(async (tx) => {
    await tx.delete(classGroup).where(and(eq(classGroup.tenantId, tenantId), eq(classGroup.id, classGroupId)));
    await tx.delete(subject).where(and(eq(subject.tenantId, tenantId), inArray(subject.id, subjectIds)));
    await tx
      .delete(studentLifecyclePeriod)
      .where(and(eq(studentLifecyclePeriod.tenantId, tenantId), inArray(studentLifecyclePeriod.studentId, studentProfileIds)));
    await tx.delete(studentProfile).where(and(eq(studentProfile.tenantId, tenantId), inArray(studentProfile.id, studentProfileIds)));
    await tx
      .delete(teacherServicePeriod)
      .where(and(eq(teacherServicePeriod.tenantId, tenantId), eq(teacherServicePeriod.teacherId, teacherId)));
    await tx.delete(teacherProfile).where(and(eq(teacherProfile.tenantId, tenantId), eq(teacherProfile.id, teacherId)));
    await tx
      .delete(schoolPerson)
      .where(and(eq(schoolPerson.tenantId, tenantId), inArray(schoolPerson.id, [teacherPersonId, ...studentPersonIds])));
    await tx
      .delete(academicSemester)
      .where(and(eq(academicSemester.tenantId, tenantId), eq(academicSemester.academicYearId, yearId)));
    await tx.delete(academicYear).where(and(eq(academicYear.tenantId, tenantId), eq(academicYear.id, yearId)));
  });

  return { cleaned: DEMO_MASTER_DATA_TYPES } as const;
}
