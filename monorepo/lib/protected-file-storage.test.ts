import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { createProtectedFileStorage, schoolAssetRetentionDays, type ProtectedFileScanner } from "@/lib/protected-file-storage";

const encryptionKey = new Uint8Array(32).fill(7);
const cleanScanner: ProtectedFileScanner = { async scan() { return { status: "clean" }; } };

test("protected file storage contract isolates Tenant keys and supports idempotent cleanup", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "simas-assets-"));
  try {
    const storage = createProtectedFileStorage(root, { encryptionKey, scanner: cleanScanner });
    const key = "tenants/tenant-1/school-profile/logo/asset-1.png";
    await storage.write("tenant-1", key, new Uint8Array([1, 2, 3]));
    assert.deepEqual(await storage.read("tenant-1", key), new Uint8Array([1, 2, 3]));
    const stored = await readFile(path.join(root, ...key.split("/")));
    assert.equal(stored.includes(Buffer.from([1, 2, 3])), false);
    await assert.rejects(storage.read("tenant-2", key), /not found/i);
    await storage.remove("tenant-1", key);
    await storage.remove("tenant-1", key);
    await assert.rejects(storage.read("tenant-1", key));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("protected writes fail closed when scanning is unavailable or rejects content", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "simas-assets-")), key = "tenants/tenant-1/people-import/source.xlsx";
  try {
    await assert.rejects(createProtectedFileStorage(root, { encryptionKey }).write("tenant-1", key, new Uint8Array([1])), /scan unavailable/i);
    const scanner: ProtectedFileScanner = { async scan() { return { status: "rejected", code: "malware" }; } };
    await assert.rejects(createProtectedFileStorage(root, { encryptionKey, scanner }).write("tenant-1", key, new Uint8Array([1])), /content rejected: malware/i);
    await assert.rejects(createProtectedFileStorage(root, { scanner: cleanScanner }).write("tenant-1", key, new Uint8Array([1])), /encryption unavailable/i);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("retention policy is enabled only by a positive configured duration", () => {
  assert.equal(schoolAssetRetentionDays({ SCHOOL_ASSET_RETENTION_DAYS: "30" }), 30);
  assert.equal(schoolAssetRetentionDays({ SCHOOL_ASSET_RETENTION_DAYS: "0" }), null);
  assert.equal(schoolAssetRetentionDays({}), null);
});
