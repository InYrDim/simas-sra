import assert from "node:assert/strict";
import test from "node:test";

import { outboxEventIdentity } from "@/lib/outbox-event-identity";

test("outbox identity separates repeated lifecycle event scopes", () => {
  assert.deepEqual([
    outboxEventIdentity({ kind: "case", caseId: "case-1" }),
    outboxEventIdentity({ kind: "transition", transitionId: "transition-1" }),
    outboxEventIdentity({ kind: "execution", executionId: "execution-1" }),
    outboxEventIdentity({ kind: "attempt", attemptId: "attempt-1" }),
  ], [
    "case:case-1",
    "transition:transition-1",
    "execution:execution-1",
    "attempt:attempt-1",
  ]);
});
