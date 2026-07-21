import type { MasterDataPrincipal } from "@/lib/tenant-master-data-access";

export type HeadmasterTeacher = Readonly<{ id: string; tenantId: string; name: string; status: "active" | "leave" | "ended"; archived: boolean }>;
export type HeadmasterAssignment = Readonly<{ id: string; tenantId: string; teacherId: string; startedAt: string; endedAt: string | null; reason: string; createdByUserId: string; createdAt: Date }>;
export type HeadmasterAssignmentView = HeadmasterAssignment & Readonly<{ teacherName: string }>;
export type HeadmasterAssignmentAudit = Readonly<{ id: string; tenantId: string; assignmentId: string; previousAssignmentId: string | null; teacherId: string; actorUserId: string; operation: "assigned" | "replaced"; effectiveDate: string; reason: string; occurredAt: Date }>;

export interface HeadmasterAssignmentTransaction {
  listAssignments(): Promise<HeadmasterAssignment[]>;
  findTeacher(id: string): Promise<HeadmasterTeacher | null>;
  closeAssignment(id: string, endedAt: string): Promise<boolean>;
  appendAssignment(value: HeadmasterAssignment): Promise<void>;
  appendAudit(value: HeadmasterAssignmentAudit): Promise<void>;
}
export interface HeadmasterAssignmentStore {
  list(tenantId: string): Promise<HeadmasterAssignment[]>;
  listTeachers(tenantId: string): Promise<HeadmasterTeacher[]>;
  listEligibleTeachers(tenantId: string): Promise<HeadmasterTeacher[]>;
  transaction<T>(tenantId: string, work: (transaction: HeadmasterAssignmentTransaction) => Promise<T>): Promise<T>;
}

const validDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
};
const failure = (code: "read-only" | "invalid-input" | "invalid-teacher" | "overlap" | "conflict") => ({ ok: false, code } as const);

export function createHeadmasterAssignmentService(dependencies: { store: HeadmasterAssignmentStore; id?: () => string; now?: () => Date }) {
  const id = dependencies.id ?? (() => crypto.randomUUID());
  const now = dependencies.now ?? (() => new Date());
  return {
    listEligibleTeachers(principal: MasterDataPrincipal) { return dependencies.store.listEligibleTeachers(principal.tenantId); },
    async getProfile(principal: MasterDataPrincipal) {
      const [assignments, teachers] = await Promise.all([dependencies.store.list(principal.tenantId), dependencies.store.listTeachers(principal.tenantId)]);
            const names = new Map(teachers.map((teacher) => [teacher.id, teacher.name]));
      const history: HeadmasterAssignmentView[] = assignments
        .map((assignment) => ({ ...assignment, teacherName: names.get(assignment.teacherId) ?? "Guru tidak tersedia" }))
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt) || b.createdAt.valueOf() - a.createdAt.valueOf());
      return { current: history.find((assignment) => assignment.endedAt === null) ?? null, history };
    },
    async assign(principal: MasterDataPrincipal, input: { teacherId: string; effectiveDate: string; reason: string }) {
      if (!principal.capabilities.write) return failure("read-only");
      const reason = input.reason.trim().replace(/\s+/g, " ");
      if (!input.teacherId || !validDate(input.effectiveDate) || !reason || reason.length > 1000) return failure("invalid-input");
      return dependencies.store.transaction(principal.tenantId, async (tx) => {
        const teacher = await tx.findTeacher(input.teacherId);
        if (!teacher || teacher.tenantId !== principal.tenantId || teacher.status !== "active" || teacher.archived) return failure("invalid-teacher");
        const assignments = await tx.listAssignments();
        const current = assignments.find((assignment) => assignment.endedAt === null);
        if (current && input.effectiveDate < current.startedAt) return failure("overlap");
        if (assignments.some((assignment) => assignment.id !== current?.id && input.effectiveDate >= assignment.startedAt && (assignment.endedAt === null || input.effectiveDate < assignment.endedAt))) return failure("overlap");
        if (current && !await tx.closeAssignment(current.id, input.effectiveDate)) return failure("conflict");
        const timestamp = now();
        const record: HeadmasterAssignment = { id: id(), tenantId: principal.tenantId, teacherId: teacher.id, startedAt: input.effectiveDate, endedAt: null, reason, createdByUserId: principal.userId, createdAt: timestamp };
        await tx.appendAssignment(record);
        await tx.appendAudit({ id: id(), tenantId: principal.tenantId, assignmentId: record.id, previousAssignmentId: current?.id ?? null, teacherId: teacher.id, actorUserId: principal.userId, operation: current ? "replaced" : "assigned", effectiveDate: input.effectiveDate, reason, occurredAt: timestamp });
        return { ok: true, record } as const;
      });
    },
  };
}
