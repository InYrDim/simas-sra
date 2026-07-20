import assert from "node:assert/strict";
import test from "node:test";

import {
  createInMemorySchoolAssetStorage,
  createUploadSchoolLogoCommand,
  inspectSchoolLogo,
  type SchoolAssetRecord,
  type SchoolAssetTransaction,
} from "@/lib/school-profile-assets";
import type { MasterDataPrincipal } from "@/lib/tenant-master-data-access";

const principal: MasterDataPrincipal = {
  userId: "admin-1",
  tenantId: "tenant-1",
  role: "school-admin",
  capabilities: { read: true, write: true, downloadTemplate: true },
};

function png(width = 256, height = 256) {
  const bytes = new Uint8Array(24);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  bytes.set([0, 0, 0, 13, 73, 72, 68, 82], 8);
  new DataView(bytes.buffer).setUint32(16, width);
  new DataView(bytes.buffer).setUint32(20, height);
  return bytes;
}

function store(options: { failCommit?: boolean } = {}) {
  let current: SchoolAssetRecord | null = null;
  const assets: SchoolAssetRecord[] = [];
  const transaction = async <T>(work: (tx: SchoolAssetTransaction) => Promise<T>) => {
    const before = current;
    const length = assets.length;
    try {
      const result = await work({
        async findCurrentLogo(tenantId) { return current?.tenantId === tenantId ? current : null; },
        async saveLogo(asset) {
          if (options.failCommit) throw new Error("database unavailable");
          assets.push(asset);
          current = asset;
        },
      });
      return result;
    } catch (error) {
      current = before;
      assets.splice(length);
      throw error;
    }
  };
  return { transaction, current: () => current, assets };
}

test("logo inspection trusts PNG content and enforces size and square dimensions", () => {
  assert.deepEqual(inspectSchoolLogo(png(), 2 * 1024 * 1024), { mimeType: "image/png", width: 256, height: 256 });
  assert.throws(() => inspectSchoolLogo(new Uint8Array([1, 2, 3]), 2 * 1024 * 1024), /JPEG, PNG, atau WebP/);
  assert.throws(() => inspectSchoolLogo(png(300, 256), 2 * 1024 * 1024), /persegi/);
  assert.throws(() => inspectSchoolLogo(png(128, 128), 2 * 1024 * 1024), /256 x 256/);
  assert.throws(() => inspectSchoolLogo(new Uint8Array(11), 10), /2 MB/);
});

test("logo upload requires retention configuration and uses Tenant-owned storage keys", async () => {
  const storage = createInMemorySchoolAssetStorage();
  const data = store();
  const upload = createUploadSchoolLogoCommand({ storage, store: data, retentionDays: null, id: () => "asset-1", now: () => new Date("2026-07-20T10:00:00Z") });
  assert.deepEqual(await upload(principal, { bytes: png(), fileName: "logo.png", declaredMimeType: "text/plain" }), { ok: false, code: "retention-not-configured" });

  const enabled = createUploadSchoolLogoCommand({ storage, store: data, retentionDays: 30, id: () => "asset-1", now: () => new Date("2026-07-20T10:00:00Z") });
  const result = await enabled(principal, { bytes: png(), fileName: "renamed.txt", declaredMimeType: "text/plain" });
  assert.equal(result.ok, true);
  assert.equal(data.current()?.storageKey, "tenants/tenant-1/school-profile/logo/asset-1.png");
  assert.deepEqual(await storage.read("tenant-1", data.current()!.storageKey), png());
  await assert.rejects(storage.read("tenant-2", data.current()!.storageKey), /not found/i);
});

test("failed database commit removes the newly stored logo without touching the database", async () => {
  const storage = createInMemorySchoolAssetStorage();
  const data = store({ failCommit: true });
  const upload = createUploadSchoolLogoCommand({ storage, store: data, retentionDays: 30, id: () => "asset-1" });
  await assert.rejects(upload(principal, { bytes: png(), fileName: "logo.png", declaredMimeType: "image/png" }), /database unavailable/);
  assert.equal(data.assets.length, 0);
  await assert.rejects(storage.read("tenant-1", "tenants/tenant-1/school-profile/logo/asset-1.png"), /not found/i);
});
