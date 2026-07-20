import type { MasterDataPrincipal } from "@/lib/tenant-master-data-access";

export const STUDENT_STATUSES = ["active", "graduated", "transferred", "withdrawn"] as const;
export const SCHOOL_PERSON_RELIGIONS = ["islam", "protestant", "catholic", "hindu", "buddhist", "confucian", "belief", "other"] as const;
export type StudentStatus = (typeof STUDENT_STATUSES)[number];
export type Gender = "male" | "female";
export type SchoolPerson = Readonly<{ id: string; tenantId: string; fullName: string; normalizedName: string; preferredName: string | null; birthPlace: string; normalizedBirthPlace: string; birthDate: string; gender: Gender; nik: string | null; nip: string | null; religion: string | null; street: string; village: string | null; district: string | null; city: string | null; province: string | null; postalCode: string | null; phone: string | null; email: string | null; accountUserId: string | null; accountActive: boolean; archived: boolean; version: number; createdAt: Date; updatedAt: Date }>;
export type StudentProfile = Readonly<{ id: string; tenantId: string; personId: string; nis: string; normalizedNis: string; nisn: string | null; externalStudentId: string | null; entryDate: string; status: StudentStatus; archived: boolean; version: number; createdAt: Date; updatedAt: Date }>;
export type StudentRecord = Readonly<{ person: SchoolPerson; student: StudentProfile; classGroupName: string | null }>;
export type StudentAudit = Readonly<{ id: string; tenantId: string; personId: string; studentId: string | null; actorUserId: string; operation: "created-person" | "created-student" | "attached-student" | "edited"; fromPersonVersion: number; toPersonVersion: number; fromStudentVersion: number; toStudentVersion: number; sensitiveBefore: { nik: string | null; nip: string | null; nis: string | null; nisn: string | null } | null; sensitiveAfter: { nik: string | null; nip: string | null; nis: string | null; nisn: string | null } | null; occurredAt: Date }>;
export interface StudentTransaction { listPeople(): Promise<SchoolPerson[]>; listStudents(): Promise<StudentProfile[]>; savePerson(value: SchoolPerson, expectedVersion: number | null): Promise<boolean>; saveStudent(value: StudentProfile, expectedVersion: number | null): Promise<boolean>; appendAudit(value: StudentAudit): Promise<void> }
export interface StudentMasterDataStore { list(tenantId: string): Promise<StudentRecord[]>; listAvailablePeople(tenantId: string): Promise<SchoolPerson[]>; transaction<T>(tenantId: string, work: (transaction: StudentTransaction) => Promise<T>): Promise<T> }
export type StudentInput = Readonly<{ fullName: string; preferredName?: string; birthPlace: string; birthDate: string; gender: string; nik?: string; nip?: string; religion?: string; street: string; village?: string; district?: string; city?: string; province?: string; postalCode?: string; phone?: string; email?: string; nis: string; nisn?: string; externalStudentId?: string; entryDate: string; existingPersonId?: string; confirmDistinct?: boolean }>;
type FailureCode = "read-only" | "invalid-input" | "duplicate-nik" | "duplicate-nip" | "duplicate-nis" | "duplicate-nisn" | "identifier-conflict" | "link-required" | "duplicate-profile" | "possible-duplicate" | "not-found" | "conflict" | "archived";
const failure = (code: FailureCode, extra?: object) => ({ ok: false, code, ...extra } as const);
const collapse = (value: string | undefined) => (value ?? "").trim().replace(/\s+/g, " ");
const optional = (value: string | undefined) => collapse(value) || null;
const digits = (value: string | undefined) => collapse(value).replace(/[^0-9]/g, "") || null;
const normalizePhone = (value: string | undefined) => { const raw = collapse(value); if (!raw) return null; const prefix = raw.startsWith("+") ? "+" : ""; return prefix + raw.replace(/\D/g, ""); };
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
function normalized(input: StudentInput, today: string) {
  const fullName = collapse(input.fullName), preferredName = optional(input.preferredName), birthPlace = collapse(input.birthPlace), birthDate = collapse(input.birthDate), street = collapse(input.street), nik = digits(input.nik), nip = digits(input.nip), nis = digits(input.nis), nisn = digits(input.nisn), phone = normalizePhone(input.phone), email = optional(input.email)?.toLocaleLowerCase("id-ID") ?? null, religion = optional(input.religion), entryDate = collapse(input.entryDate);
  if (fullName.length < 2 || fullName.length > 150 || birthPlace.length < 2 || birthPlace.length > 100 || !["male", "female"].includes(input.gender) || religion && !SCHOOL_PERSON_RELIGIONS.includes(religion as (typeof SCHOOL_PERSON_RELIGIONS)[number]) || !street || !validDate(birthDate) || birthDate > today || !validDate(entryDate) || !nis || nik && nik.length !== 16 || nip && nip.length !== 18 || nisn && nisn.length !== 10 || email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || phone && !/^\+?\d{7,15}$/.test(phone)) return null;
  return { person: { fullName, normalizedName: fullName.toLocaleLowerCase("id-ID"), preferredName, birthPlace, normalizedBirthPlace: birthPlace.toLocaleLowerCase("id-ID"), birthDate, gender: input.gender as Gender, nik, nip, religion: optional(input.religion), street, village: optional(input.village), district: optional(input.district), city: optional(input.city), province: optional(input.province), postalCode: optional(input.postalCode), phone, email }, student: { nis, normalizedNis: nis, nisn, externalStudentId: optional(input.externalStudentId), entryDate } };
}
const compatible = (person: SchoolPerson, value: NonNullable<ReturnType<typeof normalized>>["person"]) => person.normalizedName === value.normalizedName && person.birthDate === value.birthDate && person.normalizedBirthPlace === value.normalizedBirthPlace;
const sensitive = (person: SchoolPerson, student?: StudentProfile | null) => ({ nik: person.nik, nip: person.nip, nis: student?.nis ?? null, nisn: student?.nisn ?? null });
export function createStudentMasterDataService(dependencies: { store: StudentMasterDataStore; id?: () => string; now?: () => Date }) {
  const id = dependencies.id ?? (() => crypto.randomUUID()), now = dependencies.now ?? (() => new Date());
  return {
    list(principal: MasterDataPrincipal) { return dependencies.store.list(principal.tenantId); },
    listAvailablePeople(principal: MasterDataPrincipal) { return dependencies.store.listAvailablePeople(principal.tenantId); },
    create(principal: MasterDataPrincipal, input: StudentInput) {
      if (!principal.capabilities.write) return Promise.resolve(failure("read-only"));
      const timestamp = now(), value = normalized(input, timestamp.toISOString().slice(0, 10)); if (!value) return Promise.resolve(failure("invalid-input"));
      return dependencies.store.transaction(principal.tenantId, async (tx) => {
        const people = await tx.listPeople(), students = await tx.listStudents();
        if (students.some((item) => item.normalizedNis === value.student.normalizedNis)) return failure("duplicate-nis");
        if (value.student.nisn && students.some((item) => item.nisn === value.student.nisn)) return failure("duplicate-nisn");
        const identifiers = people.filter((item) => value.person.nik && item.nik === value.person.nik || value.person.nip && item.nip === value.person.nip);
        if (identifiers.some((item) => !compatible(item, value.person))) return failure("identifier-conflict");
        const candidate = input.existingPersonId ? people.find((item) => item.id === input.existingPersonId) : identifiers[0];
        if (input.existingPersonId && (!candidate || !compatible(candidate, value.person))) return failure("not-found");
        if (!input.existingPersonId && candidate) return failure("link-required", { candidatePersonIds: [candidate.id] });
        if (candidate && students.some((item) => item.personId === candidate.id)) return failure("duplicate-profile");
        const similar = people.filter((item) => compatible(item, value.person) || value.person.email && item.email === value.person.email || value.person.phone && item.phone === value.person.phone);
        if (!candidate && similar.length && !input.confirmDistinct) return failure("possible-duplicate", { candidatePersonIds: similar.map((item) => item.id) });
        const person: SchoolPerson = candidate ?? { id: id(), tenantId: principal.tenantId, ...value.person, accountUserId: null, accountActive: false, archived: false, version: 1, createdAt: timestamp, updatedAt: timestamp };
        if (person.archived) return failure("archived");
        const student: StudentProfile = { id: id(), tenantId: principal.tenantId, personId: person.id, ...value.student, status: "active", archived: false, version: 1, createdAt: timestamp, updatedAt: timestamp };
        if (!candidate && !await tx.savePerson(person, null)) return failure("conflict");
        if (!await tx.saveStudent(student, null)) return failure("conflict");
        if (!candidate) await tx.appendAudit({ id: id(), tenantId: principal.tenantId, personId: person.id, studentId: null, actorUserId: principal.userId, operation: "created-person", fromPersonVersion: 0, toPersonVersion: 1, fromStudentVersion: 0, toStudentVersion: 0, sensitiveBefore: null, sensitiveAfter: sensitive(person), occurredAt: timestamp });
        await tx.appendAudit({ id: id(), tenantId: principal.tenantId, personId: person.id, studentId: student.id, actorUserId: principal.userId, operation: candidate ? "attached-student" : "created-student", fromPersonVersion: person.version, toPersonVersion: person.version, fromStudentVersion: 0, toStudentVersion: 1, sensitiveBefore: null, sensitiveAfter: sensitive(person, student), occurredAt: timestamp });
        return { ok: true, record: { person, student, classGroupName: null } } as const;
      });
    },
    edit(principal: MasterDataPrincipal, studentId: string, input: StudentInput, personVersion: number, studentVersion: number) {
      if (!principal.capabilities.write) return Promise.resolve(failure("read-only")); const timestamp = now(), value = normalized(input, timestamp.toISOString().slice(0, 10)); if (!value || personVersion < 1 || studentVersion < 1) return Promise.resolve(failure("invalid-input"));
      return dependencies.store.transaction(principal.tenantId, async (tx) => {
        const people = await tx.listPeople(), students = await tx.listStudents(), currentStudent = students.find((item) => item.id === studentId), currentPerson = currentStudent && people.find((item) => item.id === currentStudent.personId);
        if (!currentStudent || !currentPerson) return failure("not-found"); if (currentPerson.version !== personVersion || currentStudent.version !== studentVersion) return failure("conflict"); if (currentStudent.archived || currentPerson.archived) return failure("archived");
        if (people.some((item) => item.id !== currentPerson.id && value.person.nik && item.nik === value.person.nik)) return failure("duplicate-nik"); if (people.some((item) => item.id !== currentPerson.id && value.person.nip && item.nip === value.person.nip)) return failure("duplicate-nip"); if (students.some((item) => item.id !== currentStudent.id && item.normalizedNis === value.student.normalizedNis)) return failure("duplicate-nis"); if (students.some((item) => item.id !== currentStudent.id && value.student.nisn && item.nisn === value.student.nisn)) return failure("duplicate-nisn");
        const person: SchoolPerson = { ...currentPerson, ...value.person, version: personVersion + 1, updatedAt: timestamp }, student: StudentProfile = { ...currentStudent, ...value.student, version: studentVersion + 1, updatedAt: timestamp };
        if (!await tx.savePerson(person, personVersion) || !await tx.saveStudent(student, studentVersion)) return failure("conflict");
        await tx.appendAudit({ id: id(), tenantId: principal.tenantId, personId: person.id, studentId: student.id, actorUserId: principal.userId, operation: "edited", fromPersonVersion: personVersion, toPersonVersion: person.version, fromStudentVersion: studentVersion, toStudentVersion: student.version, sensitiveBefore: sensitive(currentPerson, currentStudent), sensitiveAfter: sensitive(person, student), occurredAt: timestamp });
        return { ok: true, record: { person, student, classGroupName: null } } as const;
      });
    },
  };
}
