import assert from "node:assert/strict";
import test from "node:test";

import {
    ATTENDANCE_RECORD_LAYERS,
    ATTENDANCE_RECORD_MODES,
    ATTENDANCE_RECORD_STATUSES,
    GERBANG_STATUSES,
    KELAS_STATUSES,
    isAttendanceRecordLayer,
    isAttendanceRecordMode,
    isAttendanceRecordStatus,
    isStatusValidForLayer,
    validateAttendanceRecord,
} from "@/lib/attendance/attendance-record";

test("layer guard accepts only known layers", () => {
    assert.equal(isAttendanceRecordLayer("gerbang"), true);
    assert.equal(isAttendanceRecordLayer("kelas"), true);
    assert.equal(isAttendanceRecordLayer("ruang"), false);
    assert.equal(isAttendanceRecordLayer(42), false);
});

test("mode guard accepts only known modes", () => {
    assert.equal(isAttendanceRecordMode("manual"), true);
    assert.equal(isAttendanceRecordMode("qr"), true);
    assert.equal(isAttendanceRecordMode("kartu"), true);
    assert.equal(isAttendanceRecordMode("biometrik"), false);
});

test("status guard accepts the union of gerbang and kelas statuses", () => {
    for (const status of GERBANG_STATUSES) assert.equal(isAttendanceRecordStatus(status), true);
    for (const status of KELAS_STATUSES) assert.equal(isAttendanceRecordStatus(status), true);
    assert.equal(isAttendanceRecordStatus("telat"), false);
});

test("isStatusValidForLayer enforces the layer/status invariant", () => {
    assert.equal(isStatusValidForLayer("gerbang", "masuk"), true);
    assert.equal(isStatusValidForLayer("gerbang", "keluar"), true);
    assert.equal(isStatusValidForLayer("gerbang", "izin"), true);
    assert.equal(isStatusValidForLayer("gerbang", "sakit"), true);
    assert.equal(isStatusValidForLayer("gerbang", "hadir"), false);
    assert.equal(isStatusValidForLayer("kelas", "hadir"), true);
    assert.equal(isStatusValidForLayer("kelas", "alpa"), true);
    assert.equal(isStatusValidForLayer("kelas", "masuk"), false);
});

test("validateAttendanceRecord accepts a valid gerbang record", () => {
    const errors = validateAttendanceRecord({ layer: "gerbang", mode: "manual", status: "masuk" });
    assert.deepEqual(errors, []);
});

test("validateAttendanceRecord accepts a valid kelas record", () => {
    const errors = validateAttendanceRecord({ layer: "kelas", mode: "manual", status: "izin" });
    assert.deepEqual(errors, []);
});

test("validateAttendanceRecord rejects a status that does not match the layer", () => {
    const errors = validateAttendanceRecord({ layer: "gerbang", mode: "manual", status: "hadir" });
    assert.deepEqual(errors, ["status-layer-mismatch"]);
});

test("validateAttendanceRecord reports each invalid field independently", () => {
    const errors = validateAttendanceRecord({ layer: "lorong", mode: "telepati", status: "nganggur" });
    assert.deepEqual(errors.sort(), ["invalid-layer", "invalid-mode", "invalid-status"]);
});

test("constants expose the full vocabulary", () => {
    assert.deepEqual([...ATTENDANCE_RECORD_LAYERS], ["gerbang", "kelas"]);
    assert.deepEqual([...ATTENDANCE_RECORD_MODES], ["manual", "qr", "kartu"]);
    assert.deepEqual([...ATTENDANCE_RECORD_STATUSES], [
        "masuk",
        "keluar",
        "izin",
        "sakit",
        "hadir",
        "alpa",
    ]);
});
