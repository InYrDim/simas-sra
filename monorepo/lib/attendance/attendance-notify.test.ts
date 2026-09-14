import assert from "node:assert/strict";
import test from "node:test";

import type {
    AttendanceNotificationDependencies,
    SendAttendanceNotificationInput,
} from "@/lib/attendance/attendance-notify";
import {
    sendAttendanceNotification,
    renderTemplate,
    parseConditionalTemplate,
    evaluateConditional,
    resolveMessageTemplate,
} from "@/lib/attendance/attendance-notify";

function stubClient() {
    return {
        sendText: async () => ({ messageId: "msg-1", timestamp: Date.now() }),
    } as unknown as Parameters<NonNullable<AttendanceNotificationDependencies["createClient"]>> extends [(config: infer C) => infer R] ? R : never;
}

const baseTenantSettings = {};
const baseInput: SendAttendanceNotificationInput = {
    tenantId: "tenant-1",
    tenantSettings: baseTenantSettings,
    studentId: "student-1",
    layer: "gerbang",
    mode: "manual",
    status: "masuk",
    recordedAt: new Date("2026-01-01T08:00:00Z"),
};

function makeDeps(overrides?: Partial<AttendanceNotificationDependencies>): AttendanceNotificationDependencies {
    const deps: AttendanceNotificationDependencies = {
        resolveCredential: async () => ({ tenantId: "tenant-1", apiBaseUrl: "http://localhost", usingGlobalDefault: true, apiKey: "key", sessionKey: "session" }),
        createClient: () => stubClient(),
        readConnectionByTenantId: async () => ({ tenantId: "tenant-1", openwaSessionId: "s1", openwaSessionName: "s1", openwaWebhookId: "w1", status: "connected", botPhone: "628xx", botPushName: "Sekolah", lastError: null }),
        recordOutboundMessage: async () => undefined,
    };
    if (overrides) Object.assign(deps, overrides);
    return deps;
}

test("sendAttendanceNotification skips when absensiWhatsappNotify feature is disabled", async () => {
    const settings = { features: { absensi: true, absensiWhatsapp: false, absensiWhatsappNotify: false } };
    const result = await sendAttendanceNotification(makeDeps(), { ...baseInput, tenantSettings: settings });
    assert.equal(result.ok, true);
    assert.equal(result.skipped, true);
    if (result.ok && result.skipped) assert.equal(result.reason, "feature-disabled");
});

test("sendAttendanceNotification skips when notifyEnabled is false in mode settings", async () => {
    const settings = {
        features: { absensi: true, absensiWhatsapp: true, absensiWhatsappNotify: true },
        absensi: {
            modeSettings: {
                manual: { message: "Hello", notifyEnabled: false },
            },
        },
    };
    const result = await sendAttendanceNotification(makeDeps(), { ...baseInput, tenantSettings: settings });
    assert.equal(result.ok, true);
    assert.equal(result.skipped, true);
    if (result.ok && result.skipped) assert.equal(result.reason, "notify-disabled");
});

test("sendAttendanceNotification skips when notifyMessage is empty", async () => {
    const settings = {
        features: { absensi: true, absensiWhatsapp: true, absensiWhatsappNotify: true },
        absensi: {
            modeSettings: {
                manual: { notifyEnabled: true, notifyMessage: "" },
            },
        },
    };
    const result = await sendAttendanceNotification(makeDeps(), { ...baseInput, tenantSettings: settings });
    assert.equal(result.ok, true);
    assert.equal(result.skipped, true);
    if (result.ok && result.skipped) assert.equal(result.reason, "no-template");
});

test("parseConditionalTemplate returns null for plain template", () => {
    const parsed = parseConditionalTemplate("Hello {nama}, you are {status}.");
    assert.equal(parsed, null);
});

test("parseConditionalTemplate parses if/elseif/else/endif", () => {
    const template = `{{#if gerbang_masuk}}Masuk{{elseif gerbang_keluar}}Keluar{{else}}Lain{{/if}}`;
    const parsed = parseConditionalTemplate(template);
    assert.ok(parsed);
    assert.equal(parsed!.branches.length, 3);
    assert.equal(parsed!.branches[0].condition, "gerbang_masuk");
    assert.equal(parsed!.branches[0].content, "Masuk");
    assert.equal(parsed!.branches[1].condition, "gerbang_keluar");
    assert.equal(parsed!.branches[1].content, "Keluar");
    assert.equal(parsed!.branches[2].condition, null);
    assert.equal(parsed!.branches[2].content, "Lain");
});

test("evaluateConditional returns matching branch content", () => {
    const parsed = parseConditionalTemplate(`{{#if gerbang_masuk}}Masuk{{elseif gerbang_keluar}}Keluar{{else}}Lain{{/if}}`)!;
    assert.equal(evaluateConditional(parsed, "gerbang", "masuk"), "Masuk");
    assert.equal(evaluateConditional(parsed, "gerbang", "keluar"), "Keluar");
    assert.equal(evaluateConditional(parsed, "kelas", "hadir"), "Lain");
});

test("resolveMessageTemplate falls back to plain template when no conditional blocks", () => {
    const result = resolveMessageTemplate("Hello {nama}", "gerbang", "masuk");
    assert.equal(result, "Hello {nama}");
});

test("resolveMessageTemplate selects matching conditional block", () => {
    const template = `{{#if gerbang_masuk}}Masuk{{elseif gerbang_keluar}}Keluar{{else}}Lain{{/if}}`;
    assert.equal(resolveMessageTemplate(template, "gerbang", "masuk"), "Masuk");
    assert.equal(resolveMessageTemplate(template, "gerbang", "keluar"), "Keluar");
    assert.equal(resolveMessageTemplate(template, "kelas", "hadir"), "Lain");
});

test("resolveMessageTemplate trims selected content", () => {
    const template = `{{#if gerbang_masuk}}
      Masuk
    {{/if}}`;
    assert.equal(resolveMessageTemplate(template, "gerbang", "masuk"), "Masuk");
});

test("renderTemplate substitutes variables", () => {
    const result = renderTemplate("Yth {nama}, status {status}", { nama: "Andi", status: "Masuk" });
    assert.equal(result, "Yth Andi, status Masuk");
});

test("renderTemplate leaves unmatched placeholders intact", () => {
    const result = renderTemplate("Hello {nama}, {missing}", { nama: "Andi" });
    assert.equal(result, "Hello Andi, {missing}");
});
