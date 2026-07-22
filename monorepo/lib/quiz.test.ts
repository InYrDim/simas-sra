import assert from "node:assert/strict";
import test from "node:test";

import {
  createQuizSessionService,
  type QuizAnswerSheet,
  type QuizAttendance,
  type QuizQuestion,
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
  const answerSheets: QuizAnswerSheet[] = [];
  const questions: QuizQuestion[] = [];
  const transaction: QuizSessionTransaction = {
    async list() { return sessions; },
    async save(session) { sessions[0] = session; },
    async listQuestions() { return questions; },
    async saveQuestion() {},
    async deleteQuestion() {},
    async listAnswerSheets() { return answerSheets; },
    async findAnswerSheet(answerSheetId) { return answerSheets.find((sheet) => sheet.id === answerSheetId) ?? null; },
    async saveAnswerSheet(sheet) {
      const index = answerSheets.findIndex((current) => current.id === sheet.id);
      if (index === -1) answerSheets.push(sheet);
      else answerSheets[index] = sheet;
    },
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
  return { store, sessions, attendance, answerSheets, questions };
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

test("ending an offline session creates grading sheets only for participating students", async () => {
  const fixture = createStore([
    { id: "attendance-1", tenantId: "tenant-1", sessionId: "session-1", studentId: "student-1", status: "present", notes: null, createdAt: new Date() },
    { id: "attendance-2", tenantId: "tenant-1", sessionId: "session-1", studentId: "student-2", status: "late", notes: null, createdAt: new Date() },
    { id: "attendance-3", tenantId: "tenant-1", sessionId: "session-1", studentId: "student-3", status: "absent", notes: null, createdAt: new Date() },
  ]);
  const service = createQuizSessionService({ store: fixture.store, id: () => `sheet-${fixture.answerSheets.length + 1}` });

  const result = await service.end(principal, "session-1", ["student-1", "student-2", "student-3"]);

  assert.equal(result.ok, true);
  assert.deepEqual(fixture.answerSheets.map(({ studentId, status }) => ({ studentId, status })), [
    { studentId: "student-1", status: "submitted" },
    { studentId: "student-2", status: "submitted" },
  ]);
});

test("offline grading saves valid manual scores and requires every participant before finalization", async () => {
  const fixture = createStore();
  fixture.sessions[0] = { ...activeSession, status: "ended", endedAt: new Date() };
  fixture.questions.push({ id: "question-1", tenantId: "tenant-1", sessionId: "session-1", questionText: "Soal", questionType: "essay", options: null, correctAnswer: null, points: 10, orderIndex: 0, createdAt: new Date() });
  fixture.answerSheets.push(
    { id: "sheet-1", tenantId: "tenant-1", sessionId: "session-1", studentId: "student-1", status: "submitted", totalScore: null, maxScore: null, submittedAt: new Date(), gradedAt: null, createdAt: new Date(), updatedAt: new Date() },
    { id: "sheet-2", tenantId: "tenant-1", sessionId: "session-1", studentId: "student-2", status: "submitted", totalScore: null, maxScore: null, submittedAt: new Date(), gradedAt: null, createdAt: new Date(), updatedAt: new Date() },
  );
  const service = createQuizSessionService({ store: fixture.store, now: () => new Date("2026-07-22T10:00:00Z") });

  const firstSave = await service.saveOfflineScores(principal, "session-1", [{ studentId: "student-1", score: 8 }]);
  const incomplete = await service.finalizeOfflineGrading(principal, "session-1");
  const secondSave = await service.saveOfflineScores(principal, "session-1", [{ studentId: "student-2", score: 6 }]);
  const completed = await service.finalizeOfflineGrading(principal, "session-1");

  assert.equal(firstSave.ok, true);
  assert.deepEqual(incomplete, { ok: false, code: "grading-incomplete" });
  assert.equal(secondSave.ok, true);
  assert.equal(completed.ok, true);
  assert.equal(fixture.sessions[0].status, "graded");
  assert.deepEqual(fixture.answerSheets.map(({ totalScore, maxScore, status }) => ({ totalScore, maxScore, status })), [
    { totalScore: 8, maxScore: 10, status: "graded" },
    { totalScore: 6, maxScore: 10, status: "graded" },
  ]);
});
