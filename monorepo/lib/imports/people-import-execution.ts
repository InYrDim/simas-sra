import { createHash } from "node:crypto";

export type ExecutionDecision = { action: "link"; targetPersonId: string } | { action: "create-distinct" | "skip"; targetPersonId?: never };
export type ExecutionRow = { id: string; rowNumber: number; state: "ready" | "warning" | "rejected"; decision: ExecutionDecision | null };
export type ExecutionOutcome = "created" | "linked" | "skipped" | "rejected" | "failed" | "already-committed";
export type ClaimedExecutionRow = { executionId: string; tenantId: string; revisionId: string; rowId: string; actorId: string };
export type PeopleImportExecutionStore = {
  checkEmergencyStop(): Promise<boolean>;
  claimNext(workerId: string): Promise<ClaimedExecutionRow | null>;
  executeRow(claim: ClaimedExecutionRow): Promise<void>;
  recordFailure(claim: ClaimedExecutionRow, error: unknown): Promise<void>;
};

export function buildExecutionConfirmation(revisionId: string, rows: ExecutionRow[], selectedRowIds: string[]) {
  const selected = new Set(selectedRowIds), exact = rows.filter((row) => selected.has(row.id)).sort((a, b) => a.rowNumber - b.rowNumber);
  if (exact.length !== selected.size) throw new Error("row-not-found");
  if (exact.some((row) => row.state === "warning" && !row.decision)) throw new Error("warning-decision-required");
  const counts = { create: 0, link: 0, skip: 0, reject: 0 };
  for (const row of exact) {
    if (row.state === "rejected") counts.reject++;
    else if (row.decision?.action === "skip") counts.skip++;
    else if (row.decision?.action === "link") counts.link++;
    else counts.create++;
  }
  const ids = exact.map((row) => row.id);
  const frozenDecisions = exact.map((row) => `${row.id}:${row.state}:${row.decision?.action ?? "create"}:${row.decision?.targetPersonId ?? ""}`);
  return { revisionId, selectedRowIds: ids, rowSetHash: createHash("sha256").update(`${revisionId}:${frozenDecisions.join(",")}`).digest("hex"), counts };
}

export function createPeopleImportExecutor(store: PeopleImportExecutionStore) {
  return { async runNext(workerId: string) {
    if (await store.checkEmergencyStop()) return false;
    const claim = await store.claimNext(workerId); if (!claim) return false;
    try { await store.executeRow(claim); } catch (error) { await store.recordFailure(claim, error); }
    return true;
  } };
}

export function reconcileImportExecution(input: { selected: number; outcomes: number; successMarkers: number; distinctSuccessfulRows: number; profiles: number; histories: number; audits: number; accountsCreated: number; reportedTotal: number }) {
  const violations: string[] = [];
  if (input.outcomes !== input.selected) violations.push("outcome-count-mismatch");
  if (input.successMarkers !== input.distinctSuccessfulRows) violations.push("duplicate-success-marker");
  if (input.histories < input.profiles) violations.push("missing-history");
  if (input.audits < input.profiles) violations.push("missing-audit");
  if (input.accountsCreated > 0) violations.push("account-created");
  if (input.reportedTotal !== input.outcomes) violations.push("result-aggregate-drift");
  return violations;
}
