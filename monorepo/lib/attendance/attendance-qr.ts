/**
 * Pure decoder for the Absensi QR token (Fase 3 self-service).
 *
 * Token format (see `.scratch/absensi/spec.md`): `SIMAS|<npsn>|<layer>|<studentRef>|<direction>`
 *   - npsn: tenant NPSN; must match the scanning tenant (rejects cross-tenant tokens)
 *   - layer: GERBANG | KELAS
 *   - studentRef: NIS or studentId carried in the token
 *   - direction: IN | OUT (gerbang only; IN→masuk, OUT→keluar)
 *
 * Framework-agnostic and free of `server-only` so it stays trivially unit-testable.
 */

export type QrTokenLayer = "GERBANG" | "KELAS";
export type QrTokenDirection = "IN" | "OUT";

export type DecodedQrToken = {
    layer: QrTokenLayer;
    studentRef: string;
    direction: QrTokenDirection;
};

export type DecodeQrTokenResult =
    | { ok: true; value: DecodedQrToken }
    | { ok: false; code: "malformed" | "wrong-tenant" | "bad-layer" | "bad-direction" };

export function decodeQrToken(token: string, expectedNpsn: string): DecodeQrTokenResult {
    const parts = token.split("|");
    if (parts.length !== 5 || parts[0] !== "SIMAS") return { ok: false, code: "malformed" };

    const [, npsn, layer, studentRef, direction] = parts;
    if (npsn !== expectedNpsn) return { ok: false, code: "wrong-tenant" };
    if (layer !== "GERBANG" && layer !== "KELAS") return { ok: false, code: "bad-layer" };
    if (direction !== "IN" && direction !== "OUT") return { ok: false, code: "bad-direction" };
    if (studentRef.trim() === "") return { ok: false, code: "malformed" };

    return { ok: true, value: { layer, studentRef, direction } };
}

/**
 * Builds a student self-service QR token for the gerbang layer.
 *
 * ponytail: token is unsigned/plaintext — a student could forge another NIS.
 * Add an HMAC signature (keyed by tenant secret) when the QR is ever exposed
 * beyond the operator-picked scan flow.
 */
export function buildStudentQrToken(
    npsn: string,
    studentRef: string,
    direction: QrTokenDirection = "IN",
): string {
    return `SIMAS|${npsn}|GERBANG|${studentRef}|${direction}`;
}
