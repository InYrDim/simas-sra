import assert from "node:assert/strict";
import test from "node:test";

import { DEMO_QUIZ_QUESTIONS, DEMO_QUIZ_TOTAL_POINTS } from "@/lib/quiz-demo";

test("demo quiz contains representative question types and a stable point total", () => {
  assert.equal(DEMO_QUIZ_QUESTIONS.length, 5);
  assert.deepEqual(
    DEMO_QUIZ_QUESTIONS.map((question) => question.questionType),
    ["multiple_choice", "true_false", "multiple_choice", "essay", "true_false"],
  );
  assert.equal(DEMO_QUIZ_TOTAL_POINTS, 60);
});
