import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import type { SchoolAssetStorage } from "@/lib/school-profile-assets";

export function createProtectedFileStorage(rootDirectory: string): SchoolAssetStorage {
  const root = path.resolve(rootDirectory);
  function resolveTenantPath(tenantId: string, key: string) {
    const prefix = `tenants/${tenantId}/`;
    if (!key.startsWith(prefix) || key.includes("..") || key.includes("\\")) throw new Error("Asset not found");
    const filePath = path.resolve(root, ...key.split("/"));
    if (!filePath.startsWith(`${root}${path.sep}`)) throw new Error("Asset not found");
    return filePath;
  }
  return {
    async write(tenantId, key, bytes) {
      const filePath = resolveTenantPath(tenantId, key);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, bytes, { flag: "wx", mode: 0o600 });
    },
    async read(tenantId, key) { return new Uint8Array(await readFile(resolveTenantPath(tenantId, key))); },
    async remove(tenantId, key) { await rm(resolveTenantPath(tenantId, key), { force: true }); },
  };
}

export function schoolAssetRetentionDays(environment: Record<string, string | undefined> = process.env) {
  const value = Number(environment.SCHOOL_ASSET_RETENTION_DAYS);
  return Number.isInteger(value) && value > 0 ? value : null;
}
