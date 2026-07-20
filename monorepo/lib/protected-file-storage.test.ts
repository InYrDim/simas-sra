import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { createProtectedFileStorage, schoolAssetRetentionDays } from "@/lib/protected-file-storage";

test("protected file storage contract isolates Tenant keys and supports idempotent cleanup", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "simas-assets-"));
  try {
    const storage = createProtectedFileStorage(root);
    const key = "tenants/tenant-1/school-profile/logo/asset-1.png";
    await storage.write("tenant-1", key, new Uint8Array([1, 2, 3]));
    assert.deepEqual(await storage.read("tenant-1", key), new Uint8Array([1, 2, 3]));
    await assert.rejects(storage.read("tenant-2", key), /not found/i);
    await storage.remove("tenant-1", key);
    await storage.remove("tenant-1", key);
    await assert.rejects(storage.read("tenant-1", key));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("retention policy is enabled only by a positive configured duration", () => {
  assert.equal(schoolAssetRetentionDays({ SCHOOL_ASSET_RETENTION_DAYS: "30" }), 30);
  assert.equal(schoolAssetRetentionDays({ SCHOOL_ASSET_RETENTION_DAYS: "0" }), null);
  assert.equal(schoolAssetRetentionDays({}), null);
});
