import assert from "node:assert/strict";
import test from "node:test";

import {
  createQuizSessionService,
  type QuizAttendance,
  type QuizSession,
  type QuizSessionStore,
  type QuizSessionTransaction,
} from "@/lib/quiz";
import type { MasterDataPrincipal } from "@/lib/tenant-master-data-access";

const principal: MasterDataPrincipal = {
  userId: "user-1",
  tenantId: "tenant-1",
  role: "school-admin",
  capabilities: { read: true, write: true, downloadTemplate: true },
};

const activeSession: QuizSession = {
  id: "session-1",
  tenantId: "tenant-1",
  academicYearId: "year-1",
  subjectId: "subject-1",
  classGroupId: "group-1",
  mode: "luring",
  title: "Ulangan",
  description: null,
  status: "active",
  durationMinutes: null,
  startedAt: new Date("2026-07-22T08:00:00Z"),
  endedAt: null,
  version: 1,
  createdAt: new Date("2026-07-22T07:00:00Z"),
  updatedAt: new Date("2026-07-22T08:00:00Z"),
};

function createStore(initialAttendance: QuizAttendance[] = []) {
  const sessions = [activeSession];
  const attendance = [...initialAttendance];
  const transaction: QuizSessionTransaction = {
    async list() { return sessions; },
    async save(session) { sessions[0] = session; },
    async listQuestions() { return []; },
    async saveQuestion() {},
    async deleteQuestion() {},
    async listAnswerSheets() { return []; },
    async findAnswerSheet() { return null; },
    async saveAnswerSheet() {},
    async listAnswers() { return []; },
    async saveAnswer() {},
    async listAttendance() { return attendance; },
    async findAttendance(_sessionId, studentId) { return attendance.find((record) => record.studentId === studentId) ?? null; },
    async saveAttendance(record) {
      const index = attendance.findIndex((current) => current.studentId === record.studentId);
      if (index === -1) attendance.push(record);
      else attendance[index] = record;
    },
  };
  const store: QuizSessionStore = {
    async list() { return sessions; },
    async transaction(_tenantId, work) { return work(transaction); },
  };
  return { store, sessions, attendance };
}

test("end reports students whose attendance is incomplete", async () => {
  const fixture = createStore();
  const service = createQuizSessionService({ store: fixture.store });

  const result = await service.end(principal, "session-1", ["student-1", "student-2"]);

  assert.deepEqual(result, {
    ok: false,
    code: "attendance-incomplete",
    missingStudentIds: ["student-1", "student-2"],
  });
  assert.equal(fixture.sessions[0].status, "active");
});

test("end can mark missing students absent before ending the session", async () => {
  const fixture = createStore();
  const service = createQuizSessionService({
    store: fixture.store,
    id: () => `attendance-${fixture.attendance.length + 1}`,
    now: () => new Date("2026-07-22T09:00:00Z"),
  });

  const result = await service.end(principal, "session-1", ["student-1", "student-2"], true);

  assert.equal(result.ok, true);
  assert.equal(fixture.sessions[0].status, "ended");
  assert.deepEqual(
    fixture.attendance.map(({ studentId, status, notes }) => ({ studentId, status, notes })),
    [
      { studentId: "student-1", status: "absent", notes: "Tanpa keterangan" },
      { studentId: "student-2", status: "absent", notes: "Tanpa keterangan" },
    ],
  );
});

test("saveAttendanceBatch persists all submitted draft entries", async () => {
  const fixture = createStore();
  const service = createQuizSessionService({
    store: fixture.store,
    id: () => `attendance-${fixture.attendance.length + 1}`,
    now: () => new Date("2026-07-22T09:00:00Z"),
  });

  const result = await service.saveAttendanceBatch(principal, "session-1", [
    { studentId: "student-1", status: "present" },
    { studentId: "student-2", status: "late" },
  ]);

  assert.equal(result.ok, true);
  assert.deepEqual(
    fixture.attendance.map(({ studentId, status }) => ({ studentId, status })),
    [
      { studentId: "student-1", status: "present" },
      { studentId: "student-2", status: "late" },
    ],
  );
});
