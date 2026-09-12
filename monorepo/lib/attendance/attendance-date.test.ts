import assert from "node:assert/strict";
import test from "node:test";
import { civilDateInZone, localHHMMInZone, zonedWallClockToUtc } from "@/lib/attendance/attendance-date";

// 06:00 WIB = 23:00 UTC previous day. The civil date must follow WIB, not UTC,
// otherwise a session opened in the early morning is stored on the wrong day
// and becomes invisible to session resolution after midnight WIB.
test("civilDateInZone follows the tenant timezone, not UTC", () => {
    assert.equal(civilDateInZone(new Date("2026-08-13T23:00:00Z"), "Asia/Jakarta"), "2026-08-14");
    // 23:59 WIB (16:59 UTC) is still 2026-08-13; 00:00 WIB (17:00 UTC) rolls to 2026-08-14.
    assert.equal(civilDateInZone(new Date("2026-08-13T16:59:00Z"), "Asia/Jakarta"), "2026-08-13");
    assert.equal(civilDateInZone(new Date("2026-08-13T17:00:00Z"), "Asia/Jakarta"), "2026-08-14");
    assert.equal(civilDateInZone(new Date("2026-08-14T01:00:00Z"), "Asia/Jakarta"), "2026-08-14");
    // UTC reference is unchanged.
    assert.equal(civilDateInZone(new Date("2026-08-14T01:00:00Z"), "UTC"), "2026-08-14");
});

test("localHHMMInZone returns tenant-local HH:MM", () => {
    assert.equal(localHHMMInZone(new Date("2026-08-13T23:00:00Z"), "Asia/Jakarta"), "06:00");
    assert.equal(localHHMMInZone(new Date("2026-08-14T01:00:00Z"), "Asia/Jakarta"), "08:00");
});

test("zonedWallClockToUtc maps a local wall-clock to the correct UTC instant", () => {
    // 2026-08-14 00:00 WIB = 2026-08-13 17:00 UTC.
    const utc = zonedWallClockToUtc(new Date("2026-08-14T00:00:00Z"), "Asia/Jakarta");
    assert.equal(utc.toISOString(), "2026-08-13T17:00:00.000Z");
});
