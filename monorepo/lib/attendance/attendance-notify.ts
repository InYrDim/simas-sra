import { eq, and } from "drizzle-orm";

import { db } from "@/db";
import { schoolPerson, studentProfile, studentRelationship } from "@/db/schema";
import type { SendWhatsAppTextResult, WhatsAppBotSendDependencies } from "@/lib/integrations/whatsapp-bot/whatsapp-bot-send";
import { sendWhatsAppText } from "@/lib/integrations/whatsapp-bot/whatsapp-bot-send";
import { isTenantFeatureEnabled } from "@/lib/features/tenant-feature-policy";
import { readAbsensiSettings } from "@/lib/attendance/attendance-config";
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

function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
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
    return { ok: true, skipped: true, reason: "feature-disabled" };
  }

  const settings = readAbsensiSettings(tenantSettings);
  const modeSettings = settings.modeSettings?.[mode];
  if (!modeSettings || modeSettings.notifyEnabled !== true) {
    return { ok: true, skipped: true, reason: "notify-disabled" };
  }

  const template = modeSettings.notifyMessage?.trim();
  if (!template) {
    return { ok: true, skipped: true, reason: "no-template" };
  }

  const guardianRows = await db
    .select({ phone: studentRelationship.phone })
    .from(studentRelationship)
    .where(
      and(
        eq(studentRelationship.tenantId, tenantId),
        eq(studentRelationship.studentId, studentId),
        eq(studentRelationship.active, true),
      ),
    )
    .limit(10);

  const phones = guardianRows
    .map((r) => r.phone?.trim())
    .filter((p): p is string => !!p && p.length > 0);

  if (phones.length === 0) {
    return { ok: true, skipped: true, reason: "no-guardian-phone" };
  }

  const [studentRow] = await db
    .select({ studentName: schoolPerson.fullName })
    .from(studentProfile)
    .innerJoin(schoolPerson, and(eq(schoolPerson.tenantId, studentProfile.tenantId), eq(schoolPerson.id, studentProfile.personId)))
    .where(and(eq(studentProfile.tenantId, tenantId), eq(studentProfile.id, studentId)))
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

  const text = renderTemplate(template, vars);

  const results: Array<{ phone: string; result: SendWhatsAppTextResult }> = [];
  for (const phone of phones) {
    const result = await sendWhatsAppText(dependencies, tenantId, { chatId: phone, text });
    results.push({ phone, result });
  }

  return { ok: true, skipped: false, results };
}
