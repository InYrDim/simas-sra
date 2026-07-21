import type { SubjectInput } from "@/lib/subject-catalog";

export type ParsedSubjectForm = { id?: string; version?: number; input: SubjectInput };

export function parseSubjectForm(formData: FormData): ParsedSubjectForm | null {
  const code = String(formData.get("code") ?? "");
  const name = String(formData.get("name") ?? "");
  const description = String(formData.get("description") ?? "");
  const educationLevels = formData.getAll("educationLevels").map(String);
  const id = String(formData.get("id") ?? "").trim();
  const versionValue = String(formData.get("version") ?? "").trim();
  const version = versionValue ? Number.parseInt(versionValue, 10) : undefined;
  if (!code || !name || educationLevels.length === 0 || version !== undefined && (!Number.isSafeInteger(version) || version < 1) || Boolean(id) !== (version !== undefined)) return null;
  return { ...(id ? { id, version } : {}), input: { code, name, educationLevels, description } };
}

const safeCodes = new Set(["invalid-input", "duplicate-code", "duplicate-name", "not-found", "conflict", "archived", "already-archived", "not-archived", "read-only"]);
export function subjectResultCode(result: { ok: boolean; code?: string }) {
  if (result.ok) return "saved";
  return result.code && safeCodes.has(result.code) ? result.code : "error";
}
