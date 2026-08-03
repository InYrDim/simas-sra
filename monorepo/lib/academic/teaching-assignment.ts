export const TEACHING_ASSIGNMENT_STATUSES = ["planned", "active", "ended", "cancelled"] as const;
export type TeachingAssignmentStatus = (typeof TEACHING_ASSIGNMENT_STATUSES)[number];

export type TeachingAssignment = Readonly<{
  id: string;
  tenantId: string;
  teacherProfileId: string;
  subjectId: string;
  classGroupId: string;
  academicYearId: string;
  startsOn: string;
  endsOn: string | null;
  status: TeachingAssignmentStatus;
  reason: string;
  version: number;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}>;

export type TeachingAssignmentEndpoint = Readonly<{
  teacher: { id: string; tenantId: string; active: boolean; archived: boolean } | null;
  subject: { id: string; tenantId: string; archived: boolean; educationLevels: readonly string[] } | null;
  classGroup: { id: string; tenantId: string; academicYearId: string; educationLevel: string; lifecycle: string; archived: boolean } | null;
  academicYear: { id: string; tenantId: string; startDate: string; endDate: string; lifecycle: string; archived: boolean } | null;
}>;

export type TeachingAssignmentAudit = Readonly<{
  id: string;
  tenantId: string;
  teachingAssignmentId: string;
  actorUserId: string;
  operation: "created" | "planned-updated" | "activated" | "ended" | "cancelled" | "replaced";
  fromVersion: number;
  toVersion: number;
  effectiveOn: string;
  reason: string;
  occurredAt: Date;
}>;

export interface TeachingAssignmentStore {
  list(tenantId: string): Promise<readonly TeachingAssignment[]>;
  endpoints(tenantId: string, input: Pick<TeachingAssignment, "teacherProfileId" | "subjectId" | "classGroupId" | "academicYearId">): Promise<TeachingAssignmentEndpoint>;
  transaction<T>(tenantId: string, work: (tx: TeachingAssignmentTransaction) => Promise<T>): Promise<T>;
}

export interface TeachingAssignmentTransaction {
  list(): Promise<readonly TeachingAssignment[]>;
  endpoints(input: Pick<TeachingAssignment, "teacherProfileId" | "subjectId" | "classGroupId" | "academicYearId">): Promise<TeachingAssignmentEndpoint>;
  insert(value: TeachingAssignment): Promise<void>;
  update(value: TeachingAssignment, expectedVersion: number): Promise<boolean>;
  audit(value: TeachingAssignmentAudit): Promise<void>;
}

type Failure = "invalid-input" | "not-found" | "invalid-endpoint" | "invalid-lifecycle" | "overlap" | "conflict" | "read-only";
const failure = (code: Failure) => ({ ok: false as const, code });
const date = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
};
const intervalContains = (assignment: TeachingAssignment, effectiveOn: string) => assignment.startsOn <= effectiveOn && (assignment.endsOn === null || effectiveOn < assignment.endsOn);
const overlaps = (left: TeachingAssignment, right: Pick<TeachingAssignment, "startsOn" | "endsOn">) => left.startsOn < (right.endsOn ?? "9999-12-31") && (left.endsOn ?? "9999-12-31") > right.startsOn;
const reason = (value: string) => value.trim().replace(/\s+/g, " ");

function endpointIsEligible(endpoints: TeachingAssignmentEndpoint, assignment: Pick<TeachingAssignment, "tenantId" | "academicYearId" | "startsOn" | "endsOn" | "status">) {
  const { teacher, subject, classGroup, academicYear } = endpoints;
  if (!teacher || !subject || !classGroup || !academicYear) return false;
  if ([teacher.tenantId, subject.tenantId, classGroup.tenantId, academicYear.tenantId].some((id) => id !== assignment.tenantId)) return false;
  if (!teacher.active || teacher.archived || subject.archived || classGroup.archived || academicYear.archived) return false;
  if (classGroup.academicYearId !== assignment.academicYearId || !subject.educationLevels.includes(classGroup.educationLevel)) return false;
  if (!date(assignment.startsOn) || assignment.endsOn !== null && (!date(assignment.endsOn) || assignment.endsOn <= assignment.startsOn)) return false;
  if (assignment.startsOn < academicYear.startDate || assignment.startsOn > academicYear.endDate) return false;
  if (assignment.endsOn !== null && assignment.endsOn > academicYear.endDate) return false;
  if (assignment.status === "active" && (academicYear.lifecycle !== "active" || !["active"].includes(classGroup.lifecycle))) return false;
  if (assignment.status === "planned" && !["draft", "active"].includes(academicYear.lifecycle)) return false;
  return true;
}

export function createTeachingAssignmentService(dependencies: { store: TeachingAssignmentStore; id?: () => string; now?: () => Date }) {
  const id = dependencies.id ?? (() => crypto.randomUUID());
  const now = dependencies.now ?? (() => new Date());
  async function validate(tx: TeachingAssignmentTransaction, value: Pick<TeachingAssignment, "tenantId" | "teacherProfileId" | "subjectId" | "classGroupId" | "academicYearId" | "startsOn" | "endsOn" | "status">, ignoreId?: string) {
    if (!endpointIsEligible(await tx.endpoints(value), value)) return failure("invalid-endpoint");
    const rows = await tx.list();
    if (rows.some((row) => row.id !== ignoreId && row.status !== "cancelled" && row.teacherProfileId === value.teacherProfileId && row.subjectId === value.subjectId && row.classGroupId === value.classGroupId && row.academicYearId === value.academicYearId && overlaps(row, value))) return failure("overlap");
    return { ok: true as const };
  }
  return {
    async list(tenantId: string) { return dependencies.store.list(tenantId); },
    async create(input: Omit<TeachingAssignment, "id" | "version" | "createdAt" | "updatedAt" | "status"> & { status?: TeachingAssignmentStatus }) {
      const status = input.status ?? "planned", cleanReason = reason(input.reason), timestamp = now();
      if (!cleanReason || !date(input.startsOn) || input.endsOn !== null && !date(input.endsOn)) return failure("invalid-input");
      if (status === "active") return failure("invalid-lifecycle");
      return dependencies.store.transaction(input.tenantId, async (tx) => {
        const valid = await validate(tx, { ...input, status }); if (!valid.ok) return valid;
        const value: TeachingAssignment = { ...input, id: id(), status, reason: cleanReason, version: 1, createdAt: timestamp, updatedAt: timestamp };
        await tx.insert(value); await tx.audit({ id: id(), tenantId: value.tenantId, teachingAssignmentId: value.id, actorUserId: value.createdByUserId, operation: "created", fromVersion: 0, toVersion: 1, effectiveOn: value.startsOn, reason: cleanReason, occurredAt: timestamp });
        return { ok: true as const, record: value };
      });
    },
    async activate(tenantId: string, assignmentId: string, actorUserId: string, expectedVersion: number, effectiveOn: string, why: string) {
      return lifecycle(tenantId, assignmentId, actorUserId, expectedVersion, effectiveOn, why, "activate");
    },
    async end(tenantId: string, assignmentId: string, actorUserId: string, expectedVersion: number, effectiveOn: string, why: string) {
      return lifecycle(tenantId, assignmentId, actorUserId, expectedVersion, effectiveOn, why, "end");
    },
    async cancel(tenantId: string, assignmentId: string, actorUserId: string, expectedVersion: number, why: string) {
      return lifecycle(tenantId, assignmentId, actorUserId, expectedVersion, now().toISOString().slice(0, 10), why, "cancel");
    },
  };

  async function lifecycle(tenantId: string, assignmentId: string, actorUserId: string, expectedVersion: number, effectiveOn: string, why: string, command: "activate" | "end" | "cancel") {
    const cleanReason = reason(why); if (!cleanReason || !date(effectiveOn) || expectedVersion < 1) return failure("invalid-input");
    return dependencies.store.transaction(tenantId, async (tx) => {
      const current = (await tx.list()).find((row) => row.id === assignmentId && row.tenantId === tenantId); if (!current) return failure("not-found"); if (current.version !== expectedVersion) return failure("conflict");
      if (command === "activate" && current.status !== "planned" || command === "end" && current.status !== "active" || command === "cancel" && current.status !== "planned") return failure("invalid-lifecycle");
      if (command === "activate" && current.startsOn > effectiveOn) return failure("invalid-input");
      const endsOn = command === "end" ? effectiveOn : current.endsOn;
      if (command === "end" && effectiveOn <= current.startsOn) return failure("invalid-input");
      const status = command === "activate" ? "active" : command === "end" ? "ended" : "cancelled";
      const candidate = { ...current, status, endsOn, version: current.version + 1, updatedAt: now() } as TeachingAssignment;
      const valid = await validate(tx, candidate, current.id); if (!valid.ok) return valid;
      if (!await tx.update(candidate, expectedVersion)) return failure("conflict");
      await tx.audit({ id: id(), tenantId, teachingAssignmentId: assignmentId, actorUserId, operation: command === "activate" ? "activated" : command === "end" ? "ended" : "cancelled", fromVersion: expectedVersion, toVersion: expectedVersion + 1, effectiveOn, reason: cleanReason, occurredAt: candidate.updatedAt });
      return { ok: true as const, record: candidate };
    });
  }
}

export function isTeachingAssignmentEffective(assignment: TeachingAssignment, effectiveOn: string, academicYearEnd?: string) {
  return assignment.status === "active" && intervalContains(assignment, effectiveOn) && (academicYearEnd === undefined || effectiveOn <= academicYearEnd);
}
