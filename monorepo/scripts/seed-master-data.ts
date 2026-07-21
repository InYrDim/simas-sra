import "dotenv/config";

import { createHash } from "node:crypto";

import { and, eq } from "drizzle-orm";

import { closeDatabasePool, db } from "@/db";
import {
  schoolPerson,
  staffProfile,
  staffServicePeriod,
  studentLifecyclePeriod,
  studentProfile,
  teacherProfile,
  teacherServicePeriod,
  tenant,
  user,
} from "@/db/schema";

const domain = process.argv[2];
const actorEmail = process.argv[3];

if (!domain) {
  throw new Error(
    "Usage: pnpm db:seed:master-data <tenant-domain> [school-admin-email]",
  );
}

function deterministicId(tenantId: string, key: string) {
  const hex = createHash("sha256").update(`${tenantId}:master-data-seed:${key}`).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("id-ID").replace(/\s+/g, " ");
}

const people = [
  { key: "teacher-1", fullName: "Ahmad Hidayat", birthPlace: "Baubau", birthDate: "1984-03-12", gender: "male" as const, street: "Jl. Pendidikan No. 1", phone: "081234560001", email: "ahmad.hidayat@example.test" },
  { key: "teacher-2", fullName: "Nur Aisyah", birthPlace: "Buton", birthDate: "1987-07-21", gender: "female" as const, street: "Jl. Merdeka No. 12", phone: "081234560002", email: "nur.aisyah@example.test" },
  { key: "teacher-3", fullName: "La Ode Rahman", birthPlace: "Baubau", birthDate: "1981-11-08", gender: "male" as const, street: "Jl. Betoambari No. 8", phone: "081234560003", email: "rahman@example.test" },
  { key: "staff-1", fullName: "Wa Ode Sari", birthPlace: "Buton Selatan", birthDate: "1990-02-17", gender: "female" as const, street: "Jl. Poros Batauga No. 5", phone: "081234560004", email: "sari@example.test" },
  { key: "staff-2", fullName: "Hasan Basri", birthPlace: "Baubau", birthDate: "1988-09-04", gender: "male" as const, street: "Jl. Wolio No. 17", phone: "081234560005", email: "hasan.basri@example.test" },
  { key: "student-1", fullName: "Andi Saputra", birthPlace: "Baubau", birthDate: "2014-01-15", gender: "male" as const, street: "Kelurahan Batunapara", phone: null, email: null },
  { key: "student-2", fullName: "Siti Nurhaliza", birthPlace: "Baubau", birthDate: "2014-05-23", gender: "female" as const, street: "Kelurahan Batunapara", phone: null, email: null },
  { key: "student-3", fullName: "Muhammad Fajar", birthPlace: "Buton", birthDate: "2013-08-11", gender: "male" as const, street: "Kelurahan Batunapara", phone: null, email: null },
  { key: "student-4", fullName: "Putri Amelia", birthPlace: "Baubau", birthDate: "2013-12-02", gender: "female" as const, street: "Kelurahan Batunapara", phone: null, email: null },
  { key: "student-5", fullName: "Rizky Maulana", birthPlace: "Baubau", birthDate: "2012-04-19", gender: "male" as const, street: "Kelurahan Batunapara", phone: null, email: null },
  { key: "student-6", fullName: "Nabila Zahra", birthPlace: "Buton Tengah", birthDate: "2012-10-27", gender: "female" as const, street: "Kelurahan Batunapara", phone: null, email: null },
];

async function main() {
  const [school] = await db.select({ id: tenant.id, name: tenant.name }).from(tenant).where(eq(tenant.domain, domain)).limit(1);
  if (!school) throw new Error(`Tenant dengan domain "${domain}" tidak ditemukan`);

  const actorConditions = [eq(user.tenantId, school.id), eq(user.tenantRole, "school-admin" as const)];
  if (actorEmail) actorConditions.push(eq(user.email, actorEmail));
  const [actor] = await db.select({ id: user.id, email: user.email }).from(user).where(and(...actorConditions)).limit(1);
  if (!actor) {
    throw new Error(actorEmail ? `School admin "${actorEmail}" tidak ditemukan pada tenant "${domain}"` : `Tenant "${domain}" belum memiliki school admin`);
  }

  const now = new Date();
  const personRows = people.map((person) => ({
    id: deterministicId(school.id, `person:${person.key}`),
    tenantId: school.id,
    fullName: person.fullName,
    normalizedName: normalize(person.fullName),
    birthPlace: person.birthPlace,
    normalizedBirthPlace: normalize(person.birthPlace),
    birthDate: person.birthDate,
    gender: person.gender,
    street: person.street,
    phone: person.phone,
    email: person.email,
    archived: false,
    version: 1,
    createdAt: now,
    updatedAt: now,
  }));

  const personId = (key: string) => deterministicId(school.id, `person:${key}`);

  await db.transaction(async (tx) => {
    await tx.insert(schoolPerson).values(personRows).onDuplicateKeyUpdate({ set: { updatedAt: now } });

    const teachers = [
      { key: "teacher-1", number: "GURU-001", nuptk: "1234567890123456", employmentType: "civil-servant" as const, start: "2010-07-01" },
      { key: "teacher-2", number: "GURU-002", nuptk: "2345678901234567", employmentType: "government-contract" as const, start: "2015-07-01" },
      { key: "teacher-3", number: "GURU-003", nuptk: "3456789012345678", employmentType: "honorary" as const, start: "2018-01-08" },
    ];
    const teacherRows = teachers.map((item) => ({ id: deterministicId(school.id, `profile:${item.key}`), tenantId: school.id, personId: personId(item.key), teacherNumber: item.number, normalizedTeacherNumber: normalize(item.number), nuptk: item.nuptk, employmentType: item.employmentType, serviceStartDate: item.start, status: "active" as const, archived: false, version: 1, createdAt: now, updatedAt: now }));
    await tx.insert(teacherProfile).values(teacherRows).onDuplicateKeyUpdate({ set: { updatedAt: now } });
    await tx.insert(teacherServicePeriod).values(teachers.map((item) => ({ id: deterministicId(school.id, `period:${item.key}`), tenantId: school.id, teacherId: deterministicId(school.id, `profile:${item.key}`), status: "active" as const, startedAt: item.start, reason: "Data awal seeder", corrected: false, createdByUserId: actor.id, createdAt: now }))).onDuplicateKeyUpdate({ set: { reason: "Data awal seeder" } });

    const staff = [
      { key: "staff-1", number: "STAF-001", position: "administration" as const, employmentType: "government-contract" as const, start: "2019-07-01" },
      { key: "staff-2", number: "STAF-002", position: "library" as const, employmentType: "honorary" as const, start: "2020-01-06" },
    ];
    await tx.insert(staffProfile).values(staff.map((item) => ({ id: deterministicId(school.id, `profile:${item.key}`), tenantId: school.id, personId: personId(item.key), staffNumber: item.number, normalizedStaffNumber: normalize(item.number), position: item.position, employmentType: item.employmentType, serviceStartDate: item.start, status: "active" as const, archived: false, version: 1, createdAt: now, updatedAt: now }))).onDuplicateKeyUpdate({ set: { updatedAt: now } });
    await tx.insert(staffServicePeriod).values(staff.map((item) => ({ id: deterministicId(school.id, `period:${item.key}`), tenantId: school.id, staffId: deterministicId(school.id, `profile:${item.key}`), status: "active" as const, startedAt: item.start, reason: "Data awal seeder", corrected: false, createdByUserId: actor.id, createdAt: now }))).onDuplicateKeyUpdate({ set: { reason: "Data awal seeder" } });

    const students = people.filter((person) => person.key.startsWith("student-")).map((person, index) => ({ key: person.key, nis: `2024${String(index + 1).padStart(4, "0")}`, nisn: `00400000${String(index + 1).padStart(2, "0")}`, entryDate: index < 2 ? "2024-07-15" : index < 4 ? "2023-07-17" : "2022-07-18" }));
    await tx.insert(studentProfile).values(students.map((item) => ({ id: deterministicId(school.id, `profile:${item.key}`), tenantId: school.id, personId: personId(item.key), nis: item.nis, normalizedNis: normalize(item.nis), nisn: item.nisn, entryDate: item.entryDate, status: "active" as const, archived: false, version: 1, createdAt: now, updatedAt: now }))).onDuplicateKeyUpdate({ set: { updatedAt: now } });
    await tx.insert(studentLifecyclePeriod).values(students.map((item) => ({ id: deterministicId(school.id, `period:${item.key}`), tenantId: school.id, studentId: deterministicId(school.id, `profile:${item.key}`), status: "active" as const, startedAt: item.entryDate, reason: "Data awal seeder", corrected: false, createdByUserId: actor.id, createdAt: now }))).onDuplicateKeyUpdate({ set: { reason: "Data awal seeder" } });
  });

  console.log(`Master data untuk ${school.name} berhasil diisi: 3 guru, 2 staf, dan 6 siswa (actor: ${actor.email}).`);
}

main()
  .catch((error: unknown) => {
    console.error("Master data seeding gagal:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(closeDatabasePool);
