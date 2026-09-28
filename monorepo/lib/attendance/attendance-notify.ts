import { eq, and } from "drizzle-orm";

import { db } from "@/db";
import { schoolPerson, studentProfile, studentRelationship } from "@/db/schema";
import type { SendWhatsAppTextResult, WhatsAppBotSendDependencies } from "@/lib/integrations/whatsapp-bot/whatsapp-bot-send";
import { sendWhatsAppText } from "@/lib/integrations/whatsapp-bot/whatsapp-bot-send";
import { isTenantFeatureEnabled } from "@/lib/features/tenant-feature-policy";
import { readAbsensiSettings, readTenantTimezone } from "@/lib/attendance/attendance-config";
import { resolveOpenSession } from "@/lib/attendance/attendance-record-write";
import { localHHMMInZone } from "@/lib/attendance/attendance-date";
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
  /** Lesson context of the Kelas session (wayfinder 07: {mapel} {jam} {guru}). */
  lesson?: {
    subjectName: string;
    /** Slot start "HH:MM". */
    slotStart: string;
    teacherName: string;
  };
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

export function evaluateConditional(parsed: ParsedConditionalTemplate, layer: string, status: string, late: boolean): string {
  const lateKey = `${layer}_${status}_late`.toLowerCase();
  const normalKey = `${layer}_${status}`.toLowerCase();
  for (const branch of parsed.branches) {
    if (branch.condition === null) return branch.content;
    if (late && branch.condition === lateKey) return branch.content;
    if (!late && branch.condition === normalKey) return branch.content;
  }
  return "";
}

export function resolveMessageTemplate(template: string, layer: string, status: string, late: boolean): string {
  const parsed = parseConditionalTemplate(template);
  if (!parsed) return template;
  const selected = evaluateConditional(parsed, layer, status, late);
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

  const timezone = readTenantTimezone(tenantSettings);
  const session = await resolveOpenSession(tenantId, layer, recordedAt, timezone);
  let outOfSession = true;
  if (session) {
    const hhmm = localHHMMInZone(recordedAt, timezone);
    outOfSession = !(hhmm >= session.plannedStart && hhmm <= session.plannedEnd);
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
    terlambat: outOfSession ? "Ya" : "Tidak",
    // Per-lesson context (wayfinder 07 model C); empty when unknown so the
    // placeholder collapses instead of leaking {mapel} into the message.
    mapel: input.lesson?.subjectName ?? "",
    jam: input.lesson?.slotStart ?? "",
    guru: input.lesson?.teacherName ?? "",
  };

  const text = renderTemplate(resolveMessageTemplate(template, layer, status, outOfSession), vars);

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

export type KelasCloseNotifyStudent = {
  studentId: string;
};

export type NotifyKelasAutoAlpaInput = {
  tenantId: string;
  tenantSettings: unknown;
  /** Students that were just filled with auto-alpa at close time. */
  students: readonly KelasCloseNotifyStudent[];
  lesson: {
    subjectName: string;
    slotStart: string;
    teacherName: string;
  };
  closedAt: Date;
};

/**
 * Wayfinder 07 decision 3 (model C): when a Kelas session closes, only the
 * students that were JUST filled with auto-alpa (never recorded by the Guru)
 * notify their guardians. Students already recorded stay silent — the manual
 * record path already sent their notification, so this dedups double sends.
 * Failures never break the close path: every error is caught and logged.
 */
export async function notifyKelasAutoAlpaOnClose(
  dependencies: AttendanceNotificationDependencies,
  input: NotifyKelasAutoAlpaInput,
): Promise<{ notified: number }> {
  if (input.students.length === 0) return { notified: 0 };

  let notified = 0;
  for (const { studentId } of input.students) {
    const result = await sendAttendanceNotification(dependencies, {
      tenantId: input.tenantId,
      tenantSettings: input.tenantSettings,
      studentId,
      layer: "kelas",
      // The system fill writes mode "manual" (actor NULL); the notification
      // reads the manual template so tenants configure one surface.
      mode: "manual",
      status: "alpa",
      recordedAt: input.closedAt,
      lesson: input.lesson,
    }).catch((error) => {
      console.error("[attendance-notify] close-notify error", { tenantId: input.tenantId, studentId, error });
      return null;
    });
    if (result?.ok && !result.skipped) notified += 1;
  }
  return { notified };
}
