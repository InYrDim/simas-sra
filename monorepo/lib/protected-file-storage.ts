import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import type { SchoolAssetStorage } from "@/lib/school-profile-assets";

const MAGIC = Buffer.from("SIMASPF1", "ascii");
const IV_BYTES = 12;
const TAG_BYTES = 16;

export type ProtectedFileScanResult = { status: "clean" } | { status: "rejected"; code?: string };
export interface ProtectedFileScanner {
  scan(input: Readonly<{ tenantId: string; key: string; bytes: Uint8Array }>): Promise<ProtectedFileScanResult>;
}
export type ProtectedFileStorageOptions = Readonly<{
  encryptionKey?: Uint8Array | string;
  scanner?: ProtectedFileScanner;
  environment?: Record<string, string | undefined>;
}>;

function encryptionKey(value: Uint8Array | string | undefined, environment: Record<string, string | undefined>) {
  const configured = value ?? environment.PROTECTED_FILE_STORAGE_KEY;
  if (configured instanceof Uint8Array) return configured.byteLength === 32 ? Buffer.from(configured) : null;
  if (!configured) return null;
  const encoding = /^[0-9a-f]{64}$/i.test(configured) ? "hex" : "base64";
  const decoded = Buffer.from(configured, encoding);
  return decoded.byteLength === 32 ? decoded : null;
}

export function createProtectedFileStorage(rootDirectory: string, options: ProtectedFileStorageOptions = {}): SchoolAssetStorage {
  const root = path.resolve(rootDirectory), keyMaterial = encryptionKey(options.encryptionKey, options.environment ?? process.env), scanner = options.scanner;
  function resolveTenantPath(tenantId: string, key: string) {
    const prefix = `tenants/${tenantId}/`;
    if (!tenantId || !key.startsWith(prefix) || key.includes("..") || key.includes("\\")) throw new Error("Asset not found");
    const filePath = path.resolve(root, ...key.split("/"));
    if (!filePath.startsWith(`${root}${path.sep}`)) throw new Error("Asset not found");
    return filePath;
  }
  function requireKey() {
    if (!keyMaterial) throw new Error("Protected storage encryption unavailable");
    return keyMaterial;
  }
  return {
    async write(tenantId, key, bytes) {
      const filePath = resolveTenantPath(tenantId, key);
      if (!scanner) throw new Error("Protected storage scan unavailable");
      let result: ProtectedFileScanResult;
      try { result = await scanner.scan({ tenantId, key, bytes }); }
      catch { throw new Error("Protected storage scan unavailable"); }
      if (result.status !== "clean") throw new Error(`Protected storage content rejected${result.code ? `: ${result.code}` : ""}`);
      const iv = randomBytes(IV_BYTES), cipher = createCipheriv("aes-256-gcm", requireKey(), iv);
      cipher.setAAD(Buffer.from(`${tenantId}:${key}`, "utf8"));
      const ciphertext = Buffer.concat([cipher.update(bytes), cipher.final()]), tag = cipher.getAuthTag();
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, Buffer.concat([MAGIC, iv, tag, ciphertext]), { flag: "wx", mode: 0o600 });
    },
    async read(tenantId, key) {
      const stored = await readFile(resolveTenantPath(tenantId, key));
      if (stored.byteLength < MAGIC.byteLength + IV_BYTES + TAG_BYTES || !stored.subarray(0, MAGIC.byteLength).equals(MAGIC)) throw new Error("Protected asset is invalid");
      const ivStart = MAGIC.byteLength, tagStart = ivStart + IV_BYTES, ciphertextStart = tagStart + TAG_BYTES;
      const decipher = createDecipheriv("aes-256-gcm", requireKey(), stored.subarray(ivStart, tagStart));
      decipher.setAAD(Buffer.from(`${tenantId}:${key}`, "utf8")); decipher.setAuthTag(stored.subarray(tagStart, ciphertextStart));
      try { return new Uint8Array(Buffer.concat([decipher.update(stored.subarray(ciphertextStart)), decipher.final()])); }
      catch { throw new Error("Protected asset is invalid"); }
    },
    async remove(tenantId, key) { await rm(resolveTenantPath(tenantId, key), { force: true }); },
  };
}

export function schoolAssetRetentionDays(environment: Record<string, string | undefined> = process.env) {
  const value = Number(environment.SCHOOL_ASSET_RETENTION_DAYS);
  return Number.isInteger(value) && value > 0 ? value : null;
}
