import assert from "node:assert/strict";
import test from "node:test";

import {
  DEMO_MASTER_DATA_TYPES,
  demoAcademicPeriod,
  demoGrade,
} from "@/lib/demo-master-data";

test("demo import announces every urgent master data type", () => {
  assert.deepEqual(DEMO_MASTER_DATA_TYPES, [
    "Tahun Ajaran",
    "Siswa",
    "Guru",
    "Mata Pelajaran",
    "Rombongan Belajar",
  ]);
});

test("demo academic period follows the July to June school year", () => {
  assert.deepEqual(demoAcademicPeriod(new Date("2026-07-30T00:00:00Z")), {
    label: "2026/2027 (Demo)",
    startDate: "2026-07-01",
    oddEndDate: "2026-12-31",
    evenStartDate: "2027-01-01",
    endDate: "2027-06-30",
  });
  assert.equal(demoAcademicPeriod(new Date("2026-01-01T00:00:00Z")).label, "2025/2026 (Demo)");
});

test("demo class starts at the first grade for each education level", () => {
  assert.deepEqual([demoGrade("SD"), demoGrade("SMP"), demoGrade("SMA"), demoGrade("SMK")], [1, 7, 10, 10]);
});
