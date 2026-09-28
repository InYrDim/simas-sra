import assert from "node:assert/strict";
import test from "node:test";

import {
  addMinutesToHHMM,
  pickKelasSessionByWindow,
  resolveKelasSlotDecision,
  resolveKelasSlotDecisions,
  type KelasSlotDecisionInput,
} from "@/lib/attendance/attendance-kelas-schedule";

const slot: KelasSlotDecisionInput = {
  slotId: "slot-1",
  dayOfWeek: "monday",
  startTime: "07:00",
  endTime: "08:00",
  semester: "odd",
  assignmentStatus: "active",
  startsOn: "2026-07-01",
  endsOn: null,
};

test("slot window phases respect the tolerance-extended end", () => {
  const phaseOf = (nowHHMM: string, toleranceMinutes = 10) => {
    const decision = resolveKelasSlotDecision({ slot, civilDate: "2026-09-07", nowHHMM, toleranceMinutes });
    return decision.kind === "session" ? decision.phase : "none";
  };
  // before the slot starts
  assert.equal(phaseOf("06:59"), "before");
  // during: from start until end + tolerance
  assert.equal(phaseOf("07:00"), "during");
  assert.equal(phaseOf("08:10"), "during");
  // after the tolerance window passes
  assert.equal(phaseOf("08:11"), "after");
  // zero tolerance closes exactly at slot end
  assert.equal(phaseOf("08:00", 0), "during");
  assert.equal(phaseOf("08:01", 0), "after");
});

test("plannedEnd equals slot end plus tolerance", () => {
  const decision = resolveKelasSlotDecision({ slot, civilDate: "2026-09-07", nowHHMM: "07:30", toleranceMinutes: 10 });
  assert.equal(decision.kind, "session");
  if (decision.kind !== "session") return;
  assert.equal(decision.startTime, "07:00");
  assert.equal(decision.plannedEnd, "08:10");
});

test("inactive assignments and out-of-range dates produce no session", () => {
  assert.equal(
    resolveKelasSlotDecision({ slot: { ...slot, assignmentStatus: "ended" }, civilDate: "2026-09-07", nowHHMM: "07:30", toleranceMinutes: 10 }).kind,
    "none",
  );
  assert.equal(
    resolveKelasSlotDecision({ slot: { ...slot, assignmentStatus: "planned" }, civilDate: "2026-09-07", nowHHMM: "07:30", toleranceMinutes: 10 }).kind,
    "none",
  );
  // before startsOn
  assert.equal(
    resolveKelasSlotDecision({ slot, civilDate: "2026-06-30", nowHHMM: "07:30", toleranceMinutes: 10 }).kind,
    "none",
  );
  // on/after endsOn (exclusive)
  const bounded: KelasSlotDecisionInput = { ...slot, endsOn: "2026-09-07" };
  assert.equal(
    resolveKelasSlotDecision({ slot: bounded, civilDate: "2026-09-07", nowHHMM: "07:30", toleranceMinutes: 10 }).kind,
    "none",
  );
  assert.equal(
    resolveKelasSlotDecision({ slot: bounded, civilDate: "2026-09-06", nowHHMM: "07:30", toleranceMinutes: 10 }).kind,
    "session",
  );
});

test("holidays suppress every slot for the date", () => {
  const decisions = resolveKelasSlotDecisions({
    civilDate: "2026-08-17",
    nowHHMM: "07:30",
    slots: [slot, { ...slot, slotId: "slot-2", startTime: "09:00", endTime: "10:00" }],
    holidays: [{ startDate: "2026-08-17", endDate: "2026-08-17" }],
    toleranceMinutes: 10,
  });
  assert.deepEqual(decisions, []);
});

test("multiple slots decide independently and addMinutes wraps midnight", () => {
  const decisions = resolveKelasSlotDecisions({
    civilDate: "2026-09-07",
    nowHHMM: "07:30",
    slots: [slot, { ...slot, slotId: "slot-2", startTime: "09:00", endTime: "10:00" }],
    holidays: [],
    toleranceMinutes: 10,
  });
  assert.equal(decisions.length, 2);
  assert.deepEqual(
    decisions.map((d) => (d.kind === "session" ? d.slotId : null)),
    ["slot-1", "slot-2"],
  );

  assert.equal(addMinutesToHHMM("23:50", 15), "00:05");
  assert.equal(addMinutesToHHMM("00:05", -15), "23:50");
  assert.equal(addMinutesToHHMM("08:00", 0), "08:00");
  assert.equal(addMinutesToHHMM("07:59", 1), "08:00");
});

test("pickKelasSessionByWindow picks the containing window, earliest on overlap", () => {
  const sessions = [
    { id: "s1", plannedStart: "07:00", plannedEnd: "08:10" },
    { id: "s2", plannedStart: "09:00", plannedEnd: "10:00" },
  ];
  assert.equal(pickKelasSessionByWindow(sessions, "07:30")?.id, "s1");
  assert.equal(pickKelasSessionByWindow(sessions, "08:10")?.id, "s1");
  assert.equal(pickKelasSessionByWindow(sessions, "08:11"), null);
  assert.equal(pickKelasSessionByWindow(sessions, "10:00")?.id, "s2");
  // Overlap: 09:30 is inside both (s2 window 09:00-10:00 vs overlap 09:00-10:00).
  const overlapping = [
    { id: "a", plannedStart: "08:00", plannedEnd: "09:30" },
    { id: "b", plannedStart: "09:00", plannedEnd: "10:00" },
  ];
  assert.equal(pickKelasSessionByWindow(overlapping, "09:15")?.id, "a");
  // Inclusive start edge.
  assert.equal(pickKelasSessionByWindow(sessions, "09:00")?.id, "s2");
  assert.equal(pickKelasSessionByWindow([], "07:00"), null);
});
