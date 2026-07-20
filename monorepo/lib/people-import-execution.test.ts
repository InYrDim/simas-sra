import assert from "node:assert/strict";
import test from "node:test";
import {
  buildExecutionConfirmation,
  createPeopleImportExecutor,
  reconcileImportExecution,
  type ExecutionRow,
  type PeopleImportExecutionStore,
} from "@/lib/people-import-execution";

const rows: ExecutionRow[] = [
  { id: "r1", rowNumber: 2, state: "ready", decision: null },
  { id: "r2", rowNumber: 3, state: "warning", decision: { action: "link", targetPersonId: "p1" } },
  { id: "r3", rowNumber: 4, state: "warning", decision: { action: "skip" } },
  { id: "r4", rowNumber: 5, state: "rejected", decision: null },
];

test("confirmation freezes the exact revision and selected row set with outcome counts", () => {
  assert.deepEqual(buildExecutionConfirmation("rev-1", rows, ["r3", "r1", "r2", "r4"]), {
    revisionId: "rev-1", selectedRowIds: ["r1", "r2", "r3", "r4"], rowSetHash: "38e65eb2f196101c899cacd2ec2fcef6785882a06ca089f3aaf656fb8aa6f297",
    counts: { create: 1, link: 1, skip: 1, reject: 1 },
  });
  assert.throws(() => buildExecutionConfirmation("rev-1", [{ ...rows[1], decision: null }], ["r2"]), /warning-decision-required/);
});

function memoryStore(): PeopleImportExecutionStore & { outcomes: Map<string, string>; committed: string[] } {
  const outcomes = new Map<string, string>(), claimed = new Set<string>(), committed: string[] = [];
  return {
    outcomes, committed,
    async claimNext() { const id = ["r1", "r2"].find((x) => !claimed.has(x) && !outcomes.has(x)); if (!id) return null; claimed.add(id); return { executionId: "e1", tenantId: "t1", revisionId: "v1", rowId: id, actorId: "a1" }; },
    async checkEmergencyStop() { return false; },
    async executeRow(claim) { if (claim.rowId === "r2") throw new Error("conflict"); outcomes.set(claim.rowId, "created"); committed.push(claim.rowId); },
    async recordFailure(claim) { outcomes.set(claim.rowId, "failed"); },
  };
}

test("worker commits rows independently and restart skips terminal outcomes", async () => {
  const store = memoryStore(), executor = createPeopleImportExecutor(store);
  assert.equal(await executor.runNext("worker-a"), true);
  assert.equal(await executor.runNext("worker-a"), true);
  assert.equal(await executor.runNext("worker-restart"), false);
  assert.deepEqual(store.committed, ["r1"]);
  assert.deepEqual(Object.fromEntries(store.outcomes), { r1: "created", r2: "failed" });
});

test("emergency stop prevents claiming the next row but does not interrupt current transaction", async () => {
  let stopped = false, claims = 0, commits = 0;
  const store: PeopleImportExecutionStore = {
    async checkEmergencyStop() { return stopped; },
    async claimNext() { claims++; return { executionId: "e1", tenantId: "t1", revisionId: "v1", rowId: "r1", actorId: "a1" }; },
    async executeRow() { commits++; stopped = true; }, async recordFailure() {},
  };
  const executor = createPeopleImportExecutor(store);
  assert.equal(await executor.runNext("worker"), true);
  assert.equal(await executor.runNext("worker"), false);
  assert.equal(claims, 1); assert.equal(commits, 1);
});

test("reconciliation detects missing audit/history, duplicate success, account creation, and aggregate drift", () => {
  assert.deepEqual(reconcileImportExecution({ selected: 2, outcomes: 3, successMarkers: 2, distinctSuccessfulRows: 1, profiles: 1, histories: 0, audits: 0, accountsCreated: 1, reportedTotal: 1 }), [
    "outcome-count-mismatch", "duplicate-success-marker", "missing-history", "missing-audit", "account-created", "result-aggregate-drift",
  ]);
});
