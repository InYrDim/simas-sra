export const DEMO_MASTER_DATA_TYPES = [
  "Tahun Ajaran",
  "Siswa",
  "Guru",
  "Mata Pelajaran",
  "Rombongan Belajar",
] as const;

export type DemoEducationLevel = "SD" | "SMP" | "SMA" | "SMK";

export function demoAcademicPeriod(now: Date) {
  const year = now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return {
    label: `${year}/${year + 1} (Demo)`,
    startDate: `${year}-07-01`,
    oddEndDate: `${year}-12-31`,
    evenStartDate: `${year + 1}-01-01`,
    endDate: `${year + 1}-06-30`,
  };
}

export function demoGrade(level: DemoEducationLevel) {
  return level === "SD" ? 1 : level === "SMP" ? 7 : 10;
}
