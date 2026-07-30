import type { QuizQuestionInput } from "@/lib/quiz";

export const DEMO_QUIZ_QUESTIONS: readonly QuizQuestionInput[] = [
  {
    questionText: "Berapakah hasil dari 12 × 8?",
    questionType: "multiple_choice",
    options: ["86", "96", "106", "116"],
    correctAnswer: "96",
    points: 10,
  },
  {
    questionText: "Bilangan prima terkecil adalah 2.",
    questionType: "true_false",
    options: ["Benar", "Salah"],
    correctAnswer: "Benar",
    points: 10,
  },
  {
    questionText: "Manakah yang merupakan hasil dari 3² + 4²?",
    questionType: "multiple_choice",
    options: ["7", "12", "25", "49"],
    correctAnswer: "25",
    points: 10,
  },
  {
    questionText: "Jelaskan perbedaan antara kebutuhan dan keinginan.",
    questionType: "essay",
    correctAnswer: "Kebutuhan harus dipenuhi, sedangkan keinginan tidak harus dipenuhi.",
    points: 20,
  },
  {
    questionText: "Air membeku pada suhu 0 derajat Celsius.",
    questionType: "true_false",
    options: ["Benar", "Salah"],
    correctAnswer: "Benar",
    points: 10,
  },
];

export const DEMO_QUIZ_TOTAL_POINTS = DEMO_QUIZ_QUESTIONS.reduce(
  (total, question) => total + (question.points ?? 1),
  0,
);
