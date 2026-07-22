import type { MasterDataPrincipal } from "@/lib/tenant-master-data-access";

export type QuizSessionMode = "daring" | "luring";
export type QuizSessionStatus = "draft" | "active" | "ended" | "graded";
export type QuizQuestionType = "multiple_choice" | "true_false" | "essay";
export type QuizAnswerSheetStatus = "in_progress" | "submitted" | "graded";

export type QuizSession = Readonly<{
  id: string;
  tenantId: string;
  academicYearId: string;
  subjectId: string;
  classGroupId: string;
  mode: QuizSessionMode;
  title: string;
  description: string | null;
  status: QuizSessionStatus;
  durationMinutes: number | null;
  startedAt: Date | null;
  endedAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}>;

export type QuizQuestion = Readonly<{
  id: string;
  tenantId: string;
  sessionId: string;
  questionText: string;
  questionType: QuizQuestionType;
  options: readonly string[] | null;
  correctAnswer: string | null;
  points: number;
  orderIndex: number;
  createdAt: Date;
}>;

export type QuizAnswerSheet = Readonly<{
  id: string;
  tenantId: string;
  sessionId: string;
  studentId: string;
  status: QuizAnswerSheetStatus;
  totalScore: number | null;
  maxScore: number | null;
  submittedAt: Date | null;
  gradedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}>;

export type QuizAnswer = Readonly<{
  id: string;
  tenantId: string;
  answerSheetId: string;
  questionId: string;
  answerText: string | null;
  isCorrect: boolean | null;
  score: number | null;
  createdAt: Date;
}>;


export type QuizAttendanceStatus = "present" | "absent" | "late";

export type QuizAttendance = Readonly<{
  id: string;
  tenantId: string;
  sessionId: string;
  studentId: string;
  status: QuizAttendanceStatus;
  notes: string | null;
  createdAt: Date;
}>;

export type QuizSessionInput = Readonly<{
  academicYearId: string;
  subjectId: string;
  classGroupId: string;
  mode: QuizSessionMode;
  title: string;
  description?: string;
  durationMinutes?: number;
}>;

export type QuizQuestionInput = Readonly<{
  questionText: string;
  questionType: QuizQuestionType;
  options?: readonly string[];
  correctAnswer?: string;
  points?: number;
}>;

export interface QuizSessionTransaction {
  list(): Promise<QuizSession[]>;
  save(session: QuizSession): Promise<void>;
  listQuestions(sessionId: string): Promise<QuizQuestion[]>;
  saveQuestion(question: QuizQuestion): Promise<void>;
  deleteQuestion(questionId: string): Promise<void>;
  listAnswerSheets(sessionId: string): Promise<QuizAnswerSheet[]>;
  findAnswerSheet(answerSheetId: string): Promise<QuizAnswerSheet | null>;
  saveAnswerSheet(sheet: QuizAnswerSheet): Promise<void>;
  listAnswers(answerSheetId: string): Promise<QuizAnswer[]>;
  saveAnswer(answer: QuizAnswer): Promise<void>;
  listAttendance(sessionId: string): Promise<QuizAttendance[]>;
  findAttendance(sessionId: string, studentId: string): Promise<QuizAttendance | null>;
  saveAttendance(record: QuizAttendance): Promise<void>;
}

export interface QuizSessionStore {
  list(tenantId: string): Promise<QuizSession[]>;
  transaction<T>(tenantId: string, work: (transaction: QuizSessionTransaction) => Promise<T>): Promise<T>;
}

type FailureCode =
  | "invalid-input"
  | "not-found"
  | "invalid-transition"
  | "locked"
  | "no-questions"
  | "no-students"
  | "attendance-incomplete"
  | "grading-incomplete";

const failure = (code: FailureCode) => ({ ok: false, code } as const);

export function createQuizSessionService(dependencies: { store: QuizSessionStore; id?: () => string; now?: () => Date }) {
  const id = dependencies.id ?? (() => crypto.randomUUID());
  const now = dependencies.now ?? (() => new Date());

  return {
    list(principal: MasterDataPrincipal) {
      return dependencies.store.list(principal.tenantId);
    },

    create(principal: MasterDataPrincipal, input: QuizSessionInput) {
      if (!input.title.trim() || !input.academicYearId || !input.subjectId || !input.classGroupId) {
        return Promise.resolve(failure("invalid-input"));
      }
      const timestamp = now();
      const session: QuizSession = {
        id: id(),
        tenantId: principal.tenantId,
        academicYearId: input.academicYearId,
        subjectId: input.subjectId,
        classGroupId: input.classGroupId,
        mode: input.mode,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        status: "draft",
        durationMinutes: input.durationMinutes ?? null,
        startedAt: null,
        endedAt: null,
        version: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      return dependencies.store.transaction(principal.tenantId, async (transaction) => {
        await transaction.save(session);
        return { ok: true, session } as const;
      });
    },

    activate(principal: MasterDataPrincipal, sessionId: string) {
      return dependencies.store.transaction(principal.tenantId, async (transaction) => {
        const all = await transaction.list();
        const current = all.find((s) => s.id === sessionId && s.tenantId === principal.tenantId);
        if (!current) return failure("not-found");
        if (current.status !== "draft") return failure("invalid-transition");

        const questions = await transaction.listQuestions(sessionId);
        if (questions.length === 0) return failure("no-questions");

        const timestamp = now();
        const updated: QuizSession = {
          ...current,
          status: "active",
          startedAt: timestamp,
          version: current.version + 1,
          updatedAt: timestamp,
        };
        await transaction.save(updated);
        return { ok: true, session: updated } as const;
      });
    },

    end(principal: MasterDataPrincipal, sessionId: string, studentIds: readonly string[] = [], fillMissingAbsent = false) {
      return dependencies.store.transaction(principal.tenantId, async (transaction) => {
        const all = await transaction.list();
        const current = all.find((s) => s.id === sessionId && s.tenantId === principal.tenantId);
        if (!current) return failure("not-found");
        if (current.status !== "active") return failure("invalid-transition");

        const attendance = await transaction.listAttendance(sessionId);
        const recordedStudentIds = new Set(attendance.map((record) => record.studentId));
        const missingStudentIds = [...new Set(studentIds)].filter((studentId) => !recordedStudentIds.has(studentId));
        if (missingStudentIds.length > 0 && !fillMissingAbsent) {
          return { ...failure("attendance-incomplete"), missingStudentIds } as const;
        }
        for (const studentId of missingStudentIds) {
          await transaction.saveAttendance({
            id: id(),
            tenantId: principal.tenantId,
            sessionId,
            studentId,
            status: "absent",
            notes: "Tanpa keterangan",
            createdAt: now(),
          });
        }

        const timestamp = now();
        if (current.mode === "luring") {
          const existingSheets = await transaction.listAnswerSheets(sessionId);
          const existingStudentIds = new Set(existingSheets.map((sheet) => sheet.studentId));
          const participants = attendance.filter((record) => record.status === "present" || record.status === "late");
          for (const participant of participants) {
            if (existingStudentIds.has(participant.studentId)) continue;
            await transaction.saveAnswerSheet({
              id: id(),
              tenantId: principal.tenantId,
              sessionId,
              studentId: participant.studentId,
              status: "submitted",
              totalScore: null,
              maxScore: null,
              submittedAt: timestamp,
              gradedAt: null,
              createdAt: timestamp,
              updatedAt: timestamp,
            });
          }
        }
        const updated: QuizSession = {
          ...current,
          status: "ended",
          endedAt: timestamp,
          version: current.version + 1,
          updatedAt: timestamp,
        };
        await transaction.save(updated);
        return { ok: true, session: updated } as const;
      });
    },

    saveOfflineScores(principal: MasterDataPrincipal, sessionId: string, entries: readonly { studentId: string; score: number }[]) {
      if (entries.length === 0 || entries.some((entry) => !entry.studentId || !Number.isInteger(entry.score))) {
        return Promise.resolve(failure("invalid-input"));
      }
      return dependencies.store.transaction(principal.tenantId, async (transaction) => {
        const sessions = await transaction.list();
        const current = sessions.find((session) => session.id === sessionId && session.tenantId === principal.tenantId);
        if (!current) return failure("not-found");
        if (current.mode !== "luring" || current.status !== "ended") return failure("locked");

        const questions = await transaction.listQuestions(sessionId);
        const maxScore = questions.reduce((total, question) => total + question.points, 0);
        if (maxScore <= 0 || entries.some((entry) => entry.score < 0 || entry.score > maxScore)) return failure("invalid-input");
        const sheets = await transaction.listAnswerSheets(sessionId);
        const targets = entries.map((entry) => ({
          entry,
          sheet: sheets.find((candidate) => candidate.studentId === entry.studentId),
        }));
        if (targets.some((target) => !target.sheet)) return failure("not-found");
        const timestamp = now();
        for (const target of targets) {
          const sheet = target.sheet!;
          await transaction.saveAnswerSheet({
            ...sheet,
            status: "graded",
            totalScore: target.entry.score,
            maxScore,
            gradedAt: timestamp,
            updatedAt: timestamp,
          });
        }
        return { ok: true } as const;
      });
    },

    prepareOfflineGrading(principal: MasterDataPrincipal, sessionId: string) {
      return dependencies.store.transaction(principal.tenantId, async (transaction) => {
        const sessions = await transaction.list();
        const current = sessions.find((session) => session.id === sessionId && session.tenantId === principal.tenantId);
        if (!current) return failure("not-found");
        if (current.mode !== "luring" || current.status !== "ended") return failure("invalid-transition");
        const attendance = await transaction.listAttendance(sessionId);
        const participants = attendance.filter((record) => record.status === "present" || record.status === "late");
        if (participants.length === 0) return failure("no-students");
        const sheets = await transaction.listAnswerSheets(sessionId);
        const existingStudentIds = new Set(sheets.map((sheet) => sheet.studentId));
        const timestamp = now();
        for (const participant of participants) {
          if (existingStudentIds.has(participant.studentId)) continue;
          await transaction.saveAnswerSheet({
            id: id(),
            tenantId: principal.tenantId,
            sessionId,
            studentId: participant.studentId,
            status: "submitted",
            totalScore: null,
            maxScore: null,
            submittedAt: timestamp,
            gradedAt: null,
            createdAt: timestamp,
            updatedAt: timestamp,
          });
        }
        return { ok: true } as const;
      });
    },

    finalizeOfflineGrading(principal: MasterDataPrincipal, sessionId: string) {
      return dependencies.store.transaction(principal.tenantId, async (transaction) => {
        const sessions = await transaction.list();
        const current = sessions.find((session) => session.id === sessionId && session.tenantId === principal.tenantId);
        if (!current) return failure("not-found");
        if (current.mode !== "luring" || current.status !== "ended") return failure("invalid-transition");
        const sheets = await transaction.listAnswerSheets(sessionId);
        if (sheets.length === 0 || sheets.some((sheet) => sheet.status !== "graded")) return failure("grading-incomplete");

        const timestamp = now();
        const updated: QuizSession = { ...current, status: "graded", version: current.version + 1, updatedAt: timestamp };
        await transaction.save(updated);
        return { ok: true, session: updated } as const;
      });
    },

    grade(principal: MasterDataPrincipal, sessionId: string) {
      return dependencies.store.transaction(principal.tenantId, async (transaction) => {
        const all = await transaction.list();
        const current = all.find((s) => s.id === sessionId && s.tenantId === principal.tenantId);
        if (!current) return failure("not-found");
        if (current.status !== "ended") return failure("invalid-transition");

        const questions = await transaction.listQuestions(sessionId);
        const sheets = await transaction.listAnswerSheets(sessionId);

        for (const sheet of sheets) {
          if (sheet.status === "submitted") {
            const answers = await transaction.listAnswers(sheet.id);
            let totalScore = 0;
            let maxScore = 0;

            for (const answer of answers) {
              const question = questions.find((q) => q.id === answer.questionId);
              if (!question) continue;
              maxScore += question.points;

              const isCorrect = answer.answerText === question.correctAnswer;
              totalScore += isCorrect ? question.points : 0;

              await transaction.saveAnswer({
                ...answer,
                isCorrect,
                score: isCorrect ? question.points : 0,
              });
            }

            await transaction.saveAnswerSheet({
              ...sheet,
              status: "graded",
              totalScore,
              maxScore,
              gradedAt: now(),
              updatedAt: now(),
            });
          }
        }

        const timestamp = now();
        const updated: QuizSession = {
          ...current,
          status: "graded",
          version: current.version + 1,
          updatedAt: timestamp,
        };
        await transaction.save(updated);
        return { ok: true, session: updated } as const;
      });
    },

    addQuestion(principal: MasterDataPrincipal, sessionId: string, input: QuizQuestionInput) {
      if (!input.questionText.trim()) return Promise.resolve(failure("invalid-input"));
      return dependencies.store.transaction(principal.tenantId, async (transaction) => {
        const all = await transaction.list();
        const current = all.find((s) => s.id === sessionId && s.tenantId === principal.tenantId);
        if (!current) return failure("not-found");
        if (current.status !== "draft") return failure("locked");

        const existing = await transaction.listQuestions(sessionId);
        const question: QuizQuestion = {
          id: id(),
          tenantId: principal.tenantId,
          sessionId,
          questionText: input.questionText.trim(),
          questionType: input.questionType,
          options: input.options ?? null,
          correctAnswer: input.correctAnswer ?? null,
          points: input.points ?? 1,
          orderIndex: existing.length,
          createdAt: now(),
        };
        await transaction.saveQuestion(question);
        return { ok: true, question } as const;
      });
    },

    removeQuestion(principal: MasterDataPrincipal, sessionId: string, questionId: string) {
      return dependencies.store.transaction(principal.tenantId, async (transaction) => {
        const all = await transaction.list();
        const current = all.find((s) => s.id === sessionId && s.tenantId === principal.tenantId);
        if (!current) return failure("not-found");
        if (current.status !== "draft") return failure("locked");

        await transaction.deleteQuestion(questionId);
        return { ok: true } as const;
      });
    },

    submitAnswer(principal: MasterDataPrincipal, answerSheetId: string, questionId: string, answerText: string) {
      return dependencies.store.transaction(principal.tenantId, async (transaction) => {
        const sheet = await transaction.findAnswerSheet(answerSheetId);
        if (!sheet || sheet.tenantId !== principal.tenantId) return failure("not-found");
        if (sheet.status !== "in_progress") return failure("locked");

        const answer: QuizAnswer = {
          id: id(),
          tenantId: principal.tenantId,
          answerSheetId,
          questionId,
          answerText,
          isCorrect: null,
          score: null,
          createdAt: now(),
        };
        await transaction.saveAnswer(answer);
        return { ok: true, answer } as const;
      });
    },

    submitSheet(principal: MasterDataPrincipal, answerSheetId: string) {
      return dependencies.store.transaction(principal.tenantId, async (transaction) => {
        const sheet = await transaction.findAnswerSheet(answerSheetId);
        if (!sheet || sheet.tenantId !== principal.tenantId) return failure("not-found");
        if (sheet.status !== "in_progress") return failure("locked");

        const timestamp = now();
        const updated: QuizAnswerSheet = {
          ...sheet,
          status: "submitted",
          submittedAt: timestamp,
          updatedAt: timestamp,
        };
        await transaction.saveAnswerSheet(updated);
        return { ok: true, sheet: updated } as const;
      });
    },

    listQuestions(principal: MasterDataPrincipal, sessionId: string) {
      return dependencies.store.transaction(principal.tenantId, async (transaction) => {
        return transaction.listQuestions(sessionId);
      });
    },

    listAnswerSheets(principal: MasterDataPrincipal, sessionId: string) {
      return dependencies.store.transaction(principal.tenantId, async (transaction) => {
        return transaction.listAnswerSheets(sessionId);
      });
    },

    listAttendance(principal: MasterDataPrincipal, sessionId: string) {
      return dependencies.store.transaction(principal.tenantId, async (transaction) => {
        return transaction.listAttendance(sessionId);
      });
    },

    markAttendance(principal: MasterDataPrincipal, sessionId: string, studentId: string, status: QuizAttendanceStatus, notes?: string) {
      return this.saveAttendanceBatch(principal, sessionId, [{ studentId, status, notes }]);
    },

    saveAttendanceBatch(
      principal: MasterDataPrincipal,
      sessionId: string,
      entries: readonly { studentId: string; status: QuizAttendanceStatus; notes?: string }[],
    ) {
      if (entries.length === 0 || entries.some((entry) => !entry.studentId || !["present", "absent", "late"].includes(entry.status))) {
        return Promise.resolve(failure("invalid-input"));
      }
      return dependencies.store.transaction(principal.tenantId, async (transaction) => {
        const all = await transaction.list();
        const current = all.find((session) => session.id === sessionId && session.tenantId === principal.tenantId);
        if (!current) return failure("not-found");
        if (current.status !== "active") return failure("locked");

        const saved: QuizAttendance[] = [];
        for (const entry of entries) {
          const existing = await transaction.findAttendance(sessionId, entry.studentId);
          const record: QuizAttendance = existing
            ? { ...existing, status: entry.status, notes: entry.notes ?? existing.notes, createdAt: now() }
            : { id: id(), tenantId: principal.tenantId, sessionId, studentId: entry.studentId, status: entry.status, notes: entry.notes ?? null, createdAt: now() };
          await transaction.saveAttendance(record);
          saved.push(record);
        }
        return { ok: true, attendance: saved } as const;
      });
    },

    getAttendanceSummary(principal: MasterDataPrincipal, sessionId: string) {
      return dependencies.store.transaction(principal.tenantId, async (transaction) => {
        const attendance = await transaction.listAttendance(sessionId);
        const present = attendance.filter((a) => a.status === "present").length;
        const absent = attendance.filter((a) => a.status === "absent").length;
        const late = attendance.filter((a) => a.status === "late").length;
        return { present, absent, late, total: attendance.length, records: attendance };
      });
    },
  };
}
