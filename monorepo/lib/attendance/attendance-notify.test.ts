import assert from "node:assert/strict";
import test from "node:test";

import type {
    AttendanceNotificationDependencies,
    SendAttendanceNotificationInput,
} from "@/lib/attendance/attendance-notify";
import { sendAttendanceNotification } from "@/lib/attendance/attendance-notify";

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
