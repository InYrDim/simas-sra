import assert from "node:assert/strict";
import test from "node:test";

import {
    ATTENDANCE_LAYERS,
    ATTENDANCE_MODES,
    filterAllowedActiveLayers,
    isAttendanceLayer,
    isAttendanceMode,
    mergeAbsensiSettings,
    readAbsensiSettings,
    type AbsensiSettings,
    type AttendanceLayer,
    type AttendanceMode,
} from "@/lib/attendance/attendance-config";

const emptySettings = {};

test("type guards accept only known modes and layers", () => {
    assert.equal(isAttendanceMode("manual"), true);
    assert.equal(isAttendanceMode("qr"), true);
    assert.equal(isAttendanceMode("kartu"), true);
    assert.equal(isAttendanceMode("bogus"), false);
    assert.equal(isAttendanceMode(null), false);

    assert.equal(isAttendanceLayer("gerbang"), true);
    assert.equal(isAttendanceLayer("kelas"), true);
    assert.equal(isAttendanceLayer("bogus"), false);
});

test("readAbsensiSettings defaults to no active layers", () => {
    assert.deepEqual(readAbsensiSettings(emptySettings).activeLayers, {});
    assert.deepEqual(readAbsensiSettings(null).activeLayers, {});
    assert.deepEqual(readAbsensiSettings({ features: {} }).activeLayers, {});
});

test("readAbsensiSettings tolerates modes the Provider later disables", () => {
    const settings: AbsensiSettings = {
        activeLayers: { gerbang: ["manual"], kelas: ["qr"] },
    };
    assert.deepEqual(readAbsensiSettings({ absensi: settings }).activeLayers, {
        gerbang: ["manual"],
        kelas: ["qr"],
    });
});

test("readAbsensiSettings normalizes a legacy single-mode string into an array", () => {
    const settings = { absensi: { activeLayers: { gerbang: "manual" } } };
    assert.deepEqual(readAbsensiSettings(settings).activeLayers, { gerbang: ["manual"] });
});

test("readAbsensiSettings ignores unknown layers and non-mode values", () => {
    const settings = {
        absensi: { activeLayers: { gerbang: ["manual"], kelas: ["bogus"], unknown: ["qr"] } },
    };
    assert.deepEqual(readAbsensiSettings(settings).activeLayers, { gerbang: ["manual"] });
});

test("readAbsensiSettings dedupes repeated modes in an array", () => {
    const settings = { absensi: { activeLayers: { gerbang: ["qr", "qr", "manual"] } } };
    assert.deepEqual(readAbsensiSettings(settings).activeLayers, { gerbang: ["qr", "manual"] });
});

test("mergeAbsensiSettings keeps allowed layer+mode bindings", () => {
    const next: Partial<Record<AttendanceLayer, AttendanceMode[]>> = { gerbang: ["qr"], kelas: ["manual"] };
    const result = mergeAbsensiSettings(emptySettings, next, ATTENDANCE_MODES, ATTENDANCE_LAYERS);
    assert.deepEqual(result.activeLayers, { gerbang: ["qr"], kelas: ["manual"] });
});

test("mergeAbsensiSettings keeps multiple modes per layer", () => {
    const next: Partial<Record<AttendanceLayer, AttendanceMode[]>> = { gerbang: ["manual", "qr"] };
    const result = mergeAbsensiSettings(emptySettings, next, ATTENDANCE_MODES, ATTENDANCE_LAYERS);
    assert.deepEqual(result.activeLayers, { gerbang: ["manual", "qr"] });
});

test("mergeAbsensiSettings prunes layers not allowed by the Provider", () => {
    const next: Partial<Record<AttendanceLayer, AttendanceMode[]>> = { gerbang: ["qr"], kelas: ["manual"] };
    const result = mergeAbsensiSettings(emptySettings, next, ATTENDANCE_MODES, ["gerbang"]);
    assert.deepEqual(result.activeLayers, { gerbang: ["qr"] });
});

test("mergeAbsensiSettings prunes modes not allowed by the Provider", () => {
    const next: Partial<Record<AttendanceLayer, AttendanceMode[]>> = { gerbang: ["qr"] };
    const result = mergeAbsensiSettings(emptySettings, next, ["manual", "kartu"], ATTENDANCE_LAYERS);
    assert.deepEqual(result.activeLayers, {});
});

test("mergeAbsensiSettings preserves existing bindings when a layer is omitted", () => {
    const base: AbsensiSettings = { activeLayers: { gerbang: ["manual"], kelas: ["qr"] } };
    const result = mergeAbsensiSettings(
        { absensi: base },
        { kelas: ["kartu"] },
        ATTENDANCE_MODES,
        ATTENDANCE_LAYERS,
    );
    assert.deepEqual(result.activeLayers, { gerbang: ["manual"], kelas: ["kartu"] });
});

test("mergeAbsensiSettings drops a binding when the layer is set to null", () => {
    const base: AbsensiSettings = { activeLayers: { gerbang: ["manual"], kelas: ["qr"] } };
    const result = mergeAbsensiSettings(
        { absensi: base },
        { gerbang: null },
        ATTENDANCE_MODES,
        ATTENDANCE_LAYERS,
    );
    assert.deepEqual(result.activeLayers, { kelas: ["qr"] });
});

test("mergeAbsensiSettings never mutates the input settings", () => {
    const base: AbsensiSettings = { activeLayers: { gerbang: ["manual"] } };
    const input = { absensi: base };
    mergeAbsensiSettings(input, { kelas: ["qr"] }, ATTENDANCE_MODES, ATTENDANCE_LAYERS);
    assert.deepEqual(input.absensi.activeLayers, { gerbang: ["manual"] });
});

test("filterAllowedActiveLayers drops a layer not in allowedLayers", () => {
    const settings = { absensi: { activeLayers: { gerbang: ["manual"], kelas: ["qr"] } } };
    const result = filterAllowedActiveLayers(settings, ATTENDANCE_MODES, ["kelas"]);
    assert.deepEqual(result, { kelas: ["qr"] });
});

test("filterAllowedActiveLayers drops a binding whose mode is not allowed", () => {
    const settings = { absensi: { activeLayers: { gerbang: ["manual"], kelas: ["qr"] } } };
    const result = filterAllowedActiveLayers(settings, ["kartu"], ATTENDANCE_LAYERS);
    assert.deepEqual(result, {});
});

test("filterAllowedActiveLayers keeps bindings that are both layer- and mode-allowed", () => {
    const settings = { absensi: { activeLayers: { gerbang: ["manual"], kelas: ["qr"] } } };
    const result = filterAllowedActiveLayers(settings, ["manual", "qr"], ["gerbang", "kelas"]);
    assert.deepEqual(result, { gerbang: ["manual"], kelas: ["qr"] });
});

test("filterAllowedActiveLayers returns empty when nothing is allowed", () => {
    const settings = { absensi: { activeLayers: { gerbang: ["manual"] } } };
    const result = filterAllowedActiveLayers(settings, [], []);
    assert.deepEqual(result, {});
});

test("filterAllowedActiveLayers tolerates missing absensi settings", () => {
    const result = filterAllowedActiveLayers({}, ATTENDANCE_MODES, ATTENDANCE_LAYERS);
    assert.deepEqual(result, {});
});

test("readAbsensiSettings reads notifyEnabled and notifyMessage from modeSettings", () => {
    const settings = {
        absensi: {
            modeSettings: {
                manual: { message: "Isi manual", notifyEnabled: true, notifyMessage: "Notif {nama}" },
                qr: { scanWindow: { start: "06:00", end: "07:30" }, notifyEnabled: false },
            },
        },
    };
    const result = readAbsensiSettings(settings);
    assert.equal(result.modeSettings?.manual?.notifyEnabled, true);
    assert.equal(result.modeSettings?.manual?.notifyMessage, "Notif {nama}");
    assert.equal(result.modeSettings?.qr?.notifyEnabled, false);
    assert.equal(result.modeSettings?.qr?.notifyMessage, undefined);
});

test("readAbsensiSettings ignores non-boolean notifyEnabled and non-string notifyMessage", () => {
    const settings = {
        absensi: {
            modeSettings: {
                manual: { notifyEnabled: "yes", notifyMessage: 123 },
            },
        },
    };
    const result = readAbsensiSettings(settings);
    assert.equal(result.modeSettings?.manual?.notifyEnabled, undefined);
    assert.equal(result.modeSettings?.manual?.notifyMessage, undefined);
});
