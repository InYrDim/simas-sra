import assert from "node:assert/strict";
import { test } from "node:test";

import { decodeQrToken } from "@/lib/attendance/attendance-qr";
import { buildStudentQrToken } from "@/lib/attendance/attendance-qr";

test("decodeQrToken accepts a valid gerbang IN token", () => {
    const r = decodeQrToken("SIMAS|20100001|GERBANG|12345|IN", "20100001");
    assert.equal(r.ok, true);
    if (r.ok) {
        assert.equal(r.value.layer, "GERBANG");
        assert.equal(r.value.studentRef, "12345");
        assert.equal(r.value.direction, "IN");
    }
});

test("decodeQrToken accepts a valid kelas token", () => {
    const r = decodeQrToken("SIMAS|20100001|KELAS|12345|IN", "20100001");
    assert.equal(r.ok, true);
    if (r.ok) {
        assert.equal(r.value.layer, "KELAS");
        assert.equal(r.value.studentRef, "12345");
        assert.equal(r.value.direction, "IN");
    }
});

test("decodeQrToken rejects a cross-tenant token", () => {
    const r = decodeQrToken("SIMAS|99999999|GERBANG|12345|IN", "20100001");
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.code, "wrong-tenant");
});

test("decodeQrToken rejects a malformed token", () => {
    const r = decodeQrToken("SIMAS|20100001|GERBANG|12345", "20100001");
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.code, "malformed");
});

test("decodeQrToken rejects an unknown layer", () => {
    const r = decodeQrToken("SIMAS|20100001|LAUT|12345|IN", "20100001");
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.code, "bad-layer");
});

test("decodeQrToken rejects an unknown direction", () => {
    const r = decodeQrToken("SIMAS|20100001|GERBANG|12345|SIDE", "20100001");
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.code, "bad-direction");
});

test("buildStudentQrToken defaults to the gerbang layer", () => {
    assert.equal(buildStudentQrToken("20100001", "12345"), "SIMAS|20100001|GERBANG|12345|IN");
});

test("buildStudentQrToken builds a kelas layer token", () => {
    assert.equal(buildStudentQrToken("20100001", "12345", "IN", "KELAS"), "SIMAS|20100001|KELAS|12345|IN");
});
