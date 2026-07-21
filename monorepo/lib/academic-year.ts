import type { MasterDataPrincipal } from "@/lib/tenant-master-data-access";

export type AcademicYearLifecycle = "draft" | "active" | "closed" | "cancelled";
export type SemesterStatus = "pending" | "active" | "completed";
export type AcademicYear = Readonly<{
  id: string; tenantId: string; label: string; startDate: string; endDate: string;
  lifecycle: AcademicYearLifecycle; archived: boolean; version: number; createdAt: Date; updatedAt: Date;
  semesters: readonly Readonly<{ id: string; kind: "odd" | "even"; startDate: string; endDate: string; status: SemesterStatus }>[];
}>;
export type AcademicYearHistory = Readonly<{ id: string; tenantId: string; academicYearId: string; actorUserId: string; operation: string; effectiveDate: string; occurredAt: Date; fromLifecycle: AcademicYearLifecycle | null; toLifecycle: AcademicYearLifecycle }>;
export interface AcademicYearTransaction { list(): Promise<AcademicYear[]>; save(year: AcademicYear): Promise<void>; appendHistory(event: AcademicYearHistory): Promise<void> }
export interface AcademicYearStore { list(tenantId: string): Promise<AcademicYear[]>; transaction<T>(tenantId: string, work: (transaction: AcademicYearTransaction) => Promise<T>): Promise<T> }
export type AcademicYearInput = Readonly<{ label: string; startDate: string; endDate: string; oddStartDate: string; oddEndDate: string; evenStartDate: string; evenEndDate: string }>;

type FailureCode = "invalid-input" | "duplicate-label" | "overlapping-year" | "not-found" | "invalid-transition" | "active-conflict" | "not-terminal" | "already-archived" | "not-archived";
const failure = (code: FailureCode) => ({ ok: false, code } as const);
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
function nextDay(date: string) { const value = new Date(`${date}T00:00:00Z`); value.setUTCDate(value.getUTCDate() + 1); return value.toISOString().slice(0, 10); }
function validInput(input: AcademicYearInput) {
  const values = [input.startDate, input.endDate, input.oddStartDate, input.oddEndDate, input.evenStartDate, input.evenEndDate];
  return Boolean(input.label.trim()) && values.every((value) => datePattern.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))) &&
    input.startDate < input.endDate && input.oddStartDate === input.startDate && input.evenEndDate === input.endDate &&
    input.oddStartDate <= input.oddEndDate && input.evenStartDate <= input.evenEndDate && nextDay(input.oddEndDate) === input.evenStartDate;
}
function overlaps(a: Pick<AcademicYear, "startDate" | "endDate">, b: Pick<AcademicYear, "startDate" | "endDate">) { return a.startDate <= b.endDate && b.startDate <= a.endDate; }

export function createAcademicYearService(dependencies: { store: AcademicYearStore; id?: () => string; now?: () => Date }) {
  const id = dependencies.id ?? (() => crypto.randomUUID());
  const now = dependencies.now ?? (() => new Date());
  async function mutate(principal: MasterDataPrincipal, academicYearId: string, effectiveDate: string, operation: string, change: (year: AcademicYear, all: AcademicYear[]) => AcademicYear | FailureCode) {
    if (!datePattern.test(effectiveDate)) return failure("invalid-input");
    return dependencies.store.transaction(principal.tenantId, async (transaction) => {
      const all = await transaction.list();
      const current = all.find((year) => year.id === academicYearId && year.tenantId === principal.tenantId);
      if (!current) return failure("not-found");
      const result = change(current, all);
      if (typeof result === "string") return failure(result);
      await transaction.save(result);
      await transaction.appendHistory({ id: id(), tenantId: principal.tenantId, academicYearId, actorUserId: principal.userId, operation, effectiveDate, occurredAt: result.updatedAt, fromLifecycle: current.lifecycle, toLifecycle: result.lifecycle });
      return { ok: true, year: result } as const;
    });
  }
  return {
    list(principal: MasterDataPrincipal) { return dependencies.store.list(principal.tenantId); },
    create(principal: MasterDataPrincipal, input: AcademicYearInput) {
      if (!validInput(input)) return Promise.resolve(failure("invalid-input"));
      return dependencies.store.transaction(principal.tenantId, async (transaction) => {
        const all = await transaction.list();
        const label = input.label.trim().replace(/\s+/g, " ");
        if (all.some((year) => year.label.toLocaleLowerCase("id-ID") === label.toLocaleLowerCase("id-ID"))) return failure("duplicate-label");
        if (all.some((year) => overlaps(year, input))) return failure("overlapping-year");
        const timestamp = now();
        const year: AcademicYear = { id: id(), tenantId: principal.tenantId, label, startDate: input.startDate, endDate: input.endDate, lifecycle: "draft", archived: false, version: 1, createdAt: timestamp, updatedAt: timestamp, semesters: [
          { id: id(), kind: "odd", startDate: input.oddStartDate, endDate: input.oddEndDate, status: "pending" },
          { id: id(), kind: "even", startDate: input.evenStartDate, endDate: input.evenEndDate, status: "pending" },
        ] };
        await transaction.save(year);
        await transaction.appendHistory({ id: id(), tenantId: principal.tenantId, academicYearId: year.id, actorUserId: principal.userId, operation: "created", effectiveDate: input.startDate, occurredAt: timestamp, fromLifecycle: null, toLifecycle: "draft" });
        return { ok: true, year } as const;
      });
    },
    transition(principal: MasterDataPrincipal, yearId: string, action: "activate" | "start-even" | "close" | "cancel", effectiveDate: string) {
      return mutate(principal, yearId, effectiveDate, action, (year, all) => {
        if (year.archived) return "invalid-transition";
        let lifecycle = year.lifecycle; let semesters = [...year.semesters];
        if (action === "activate" && year.lifecycle === "draft") { if (all.some((item) => item.id !== year.id && item.lifecycle === "active")) return "active-conflict"; lifecycle = "active"; semesters = semesters.map((semester) => ({ ...semester, status: semester.kind === "odd" ? "active" as const : "pending" as const })); }
        else if (action === "start-even" && year.lifecycle === "active" && semesters[0].status === "active") semesters = semesters.map((semester) => ({ ...semester, status: semester.kind === "odd" ? "completed" as const : "active" as const }));
        else if (action === "close" && year.lifecycle === "active" && semesters[1].status === "active") { lifecycle = "closed"; semesters = semesters.map((semester) => ({ ...semester, status: "completed" as const })); }
        else if (action === "cancel" && year.lifecycle === "draft") lifecycle = "cancelled";
        else return "invalid-transition";
        return { ...year, lifecycle, semesters, version: year.version + 1, updatedAt: now() };
      });
    },
    archive(principal: MasterDataPrincipal, yearId: string, effectiveDate: string) { return mutate(principal, yearId, effectiveDate, "archived", (year) => year.archived ? "already-archived" : !["closed", "cancelled"].includes(year.lifecycle) ? "not-terminal" : { ...year, archived: true, version: year.version + 1, updatedAt: now() }); },
    reactivate(principal: MasterDataPrincipal, yearId: string, effectiveDate: string) { return mutate(principal, yearId, effectiveDate, "reactivated", (year) => !year.archived ? "not-archived" : { ...year, archived: false, version: year.version + 1, updatedAt: now() }); },
  };
}
