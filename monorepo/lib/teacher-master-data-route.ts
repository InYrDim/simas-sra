import type { TeacherInput } from "@/lib/teacher-master-data";
export type ParsedTeacherForm = { id?: string; personVersion?: number; teacherVersion?: number; input: TeacherInput };
const fields = ["fullName", "preferredName", "birthPlace", "birthDate", "gender", "nik", "nip", "religion", "street", "village", "district", "city", "province", "postalCode", "phone", "email", "teacherNumber", "nuptk", "employmentType", "assignmentStatus", "serviceStartDate", "existingPersonId"] as const;
export function parseTeacherForm(form: FormData): ParsedTeacherForm | null { const values = Object.fromEntries(fields.map((field) => [field, String(form.get(field) ?? "")])) as unknown as TeacherInput; if (!values.fullName || !values.birthPlace || !values.birthDate || !values.gender || !values.street || !values.teacherNumber || !values.serviceStartDate || !values.employmentType || !values.assignmentStatus) return null; const id = String(form.get("id") ?? "").trim(), pv = Number.parseInt(String(form.get("personVersion") ?? ""), 10), sv = Number.parseInt(String(form.get("teacherVersion") ?? ""), 10), editing = Boolean(id); if (editing !== (Number.isSafeInteger(pv) && pv > 0 && Number.isSafeInteger(sv) && sv > 0)) return null; return { ...(editing ? { id, personVersion: pv, teacherVersion: sv } : {}), input: { ...values, confirmDistinct: form.get("confirmDistinct") === "true" } }; }
export type ParsedTeacherLifecycleForm =
  | { id: string; expectedVersion: number; operation: "transition"; toStatus: "active" | "leave" | "ended"; effectiveDate: string; reason: string; notes: string }
  | { id: string; expectedVersion: number; operation: "archive" | "reactivate"; reason: string };
export function parseTeacherLifecycleForm(form: FormData): ParsedTeacherLifecycleForm | null {
  const id = String(form.get("id") ?? "").trim(), expectedVersion = Number.parseInt(String(form.get("expectedVersion") ?? ""), 10), operation = String(form.get("operation") ?? ""), reason = String(form.get("reason") ?? "").trim();
  if (!id || !Number.isSafeInteger(expectedVersion) || expectedVersion < 1 || !reason) return null;
  if (operation === "archive" || operation === "reactivate") return { id, expectedVersion, operation, reason };
  const toStatus = String(form.get("toStatus") ?? ""), effectiveDate = String(form.get("effectiveDate") ?? ""), notes = String(form.get("notes") ?? "").trim();
  if (operation !== "transition" || !["active", "leave", "ended"].includes(toStatus) || !/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)) return null;
  return { id, expectedVersion, operation, toStatus: toStatus as "active" | "leave" | "ended", effectiveDate, reason, notes };
}
const safe = new Set(["invalid-input", "duplicate-nik", "duplicate-nip", "duplicate-teacherNumber", "duplicate-nuptk", "identifier-conflict", "link-required", "duplicate-profile", "possible-duplicate", "not-found", "conflict", "archived", "read-only", "invalid-transition", "invalid-effective-date", "future-transition", "service-correction-required", "active-status", "relationship-blocked", "not-archived"]);
export function teacherResultCode(result: { ok: boolean; code?: string }) { return result.ok ? "saved" : result.code && safe.has(result.code) ? result.code : "error"; }
