import { eq, and } from "drizzle-orm";

import { db } from "@/db";
import { schoolPerson, studentProfile, studentRelationship } from "@/db/schema";
import type { SendWhatsAppTextResult, WhatsAppBotSendDependencies } from "@/lib/integrations/whatsapp-bot/whatsapp-bot-send";
import { sendWhatsAppText } from "@/lib/integrations/whatsapp-bot/whatsapp-bot-send";
import { isTenantFeatureEnabled } from "@/lib/features/tenant-feature-policy";
import { readAbsensiSettings } from "@/lib/attendance/attendance-config";
import { resolveStudentIdentity } from "@/lib/attendance/attendance-record-write";
import type { AttendanceLayer, AttendanceMode } from "@/lib/attendance/attendance-config";

export type AttendanceNotificationDependencies = WhatsAppBotSendDependencies;

export type SendAttendanceNotificationInput = {
  tenantId: string;
  tenantSettings: unknown;
  studentId: string;
  layer: AttendanceLayer;
  mode: AttendanceMode;
  status: string;
  recordedAt: Date;
};

export type SendAttendanceNotificationResult =
  | { ok: true; skipped: true; reason: string }
  | { ok: true; skipped: false; results: Array<{ phone: string; result: SendWhatsAppTextResult }> }
  | { ok: false; code: "feature-disabled" | "notify-disabled" | "no-guardian-phone" | "no-template" | "error" };

export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

export interface ConditionalBranch {
  condition: string | null;
  content: string;
}

export interface ParsedConditionalTemplate {
  branches: ConditionalBranch[];
}

export function parseConditionalTemplate(template: string): ParsedConditionalTemplate | null {
  const trimmed = template.trim();
  if (!trimmed.startsWith("{{#if ")) return null;

  const firstIfMatch = trimmed.match(/^\{\{#if\s+([a-z_]+)\s*\}\}([\s\S]*)/i);
  if (!firstIfMatch) return null;

  const branches: ConditionalBranch[] = [];
  let currentCondition: string | null = firstIfMatch[1].toLowerCase();
  let currentContent = "";
  let remaining = firstIfMatch[2];

  while (remaining.length > 0) {
    const elseifMatch = remaining.match(/^\{\{elseif\s+([a-z_]+)\s*\}\}/i);
    const elseMatch = remaining.match(/^\{\{else\s*\}\}/i);
    const endifMatch = remaining.match(/^\{\{\/if\s*\}\}/i);

    if (endifMatch) {
      branches.push({ condition: currentCondition, content: currentContent });
      remaining = remaining.slice(endifMatch[0].length);
      break;
    } else if (elseifMatch) {
      branches.push({ condition: currentCondition, content: currentContent });
      currentCondition = elseifMatch[1].toLowerCase();
      currentContent = "";
      remaining = remaining.slice(elseifMatch[0].length);
    } else if (elseMatch) {
      branches.push({ condition: currentCondition, content: currentContent });
      currentCondition = null;
      currentContent = "";
      remaining = remaining.slice(elseMatch[0].length);
    } else {
      currentContent += remaining[0];
      remaining = remaining.slice(1);
    }
  }

  return { branches };
}

export function evaluateConditional(parsed: ParsedConditionalTemplate, layer: string, status: string): string {
  const key = `${layer}_${status}`.toLowerCase();
  for (const branch of parsed.branches) {
    if (branch.condition === null) return branch.content;
    if (branch.condition === key) return branch.content;
  }
  return "";
}

export function resolveMessageTemplate(template: string, layer: string, status: string): string {
  const parsed = parseConditionalTemplate(template);
  if (!parsed) return template;
  const selected = evaluateConditional(parsed, layer, status);
  return selected.trim();
}

function resolveStatusLabel(status: string, layer: AttendanceLayer): string {
  const labels: Record<string, Record<string, string>> = {
    gerbang: { masuk: "Masuk", keluar: "Keluar", izin: "Izin", sakit: "Sakit" },
    kelas: { hadir: "Hadir", izin: "Izin", sakit: "Sakit", alpa: "Alpa" },
  };
  return labels[layer]?.[status] ?? status;
}

export async function sendAttendanceNotification(
  dependencies: AttendanceNotificationDependencies,
  input: SendAttendanceNotificationInput,
): Promise<SendAttendanceNotificationResult> {
  const { tenantId, tenantSettings, studentId, layer, mode, status, recordedAt } = input;

  if (!isTenantFeatureEnabled(tenantSettings, "absensiWhatsappNotify")) {
    console.warn("[attendance-notify] skipped: feature-disabled", { tenantId, studentId, layer, mode });
    return { ok: true, skipped: true, reason: "feature-disabled" };
  }

  const settings = readAbsensiSettings(tenantSettings);
  const modeSettings = settings.modeSettings?.[mode];
  if (!modeSettings || modeSettings.notifyEnabled !== true) {
    console.warn("[attendance-notify] skipped: notify-disabled", { tenantId, studentId, layer, mode, hasModeSettings: Boolean(modeSettings) });
    return { ok: true, skipped: true, reason: "notify-disabled" };
  }

  const template = modeSettings.notifyMessage?.trim();
  if (!template) {
    console.warn("[attendance-notify] skipped: no-template", { tenantId, studentId, layer, mode });
    return { ok: true, skipped: true, reason: "no-template" };
  }

  const resolved = await resolveStudentIdentity(tenantId, studentId);
  const resolvedStudentId = resolved?.studentId ?? studentId;

  const guardianRows = await db
    .select({ phone: studentRelationship.phone })
    .from(studentRelationship)
    .where(
      and(
        eq(studentRelationship.tenantId, tenantId),
        eq(studentRelationship.studentId, resolvedStudentId),
        eq(studentRelationship.active, true),
      ),
    )
    .limit(10);

  const phones = guardianRows
    .map((r) => r.phone?.trim())
    .filter((p): p is string => !!p && p.length > 0);

  if (phones.length === 0) {
    console.warn("[attendance-notify] skipped: no-guardian-phone", { tenantId, studentId, resolvedStudentId, layer, mode, guardians: guardianRows.length });
    return { ok: true, skipped: true, reason: "no-guardian-phone" };
  }

  const [studentRow] = await db
    .select({ studentName: schoolPerson.fullName })
    .from(studentProfile)
    .innerJoin(schoolPerson, and(eq(schoolPerson.tenantId, studentProfile.tenantId), eq(schoolPerson.id, studentProfile.personId)))
    .where(and(eq(studentProfile.tenantId, tenantId), eq(studentProfile.id, resolvedStudentId)))
    .limit(1);

  const studentName = studentRow?.studentName ?? "";

  const timeStr = recordedAt.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  const dateStr = recordedAt.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

  const vars: Record<string, string> = {
    nama: studentName,
    nis: studentId,
    status: resolveStatusLabel(status, layer),
    waktu: `${dateStr} ${timeStr}`,
    layer: layer === "gerbang" ? "gerbang" : "kelas",
  };

  const text = renderTemplate(resolveMessageTemplate(template, layer, status), vars);

  const results: Array<{ phone: string; result: SendWhatsAppTextResult }> = [];
  for (const phone of phones) {
    try {
      const result = await sendWhatsAppText(dependencies, tenantId, { chatId: phone, text });
      results.push({ phone, result });
    } catch (error) {
      console.error("[attendance-notify] send error", { tenantId, studentId, phone, error });
      results.push({ phone, result: { ok: false, code: "error" } });
    }
  }

  return { ok: true, skipped: false, results };
}
