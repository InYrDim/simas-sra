import type { MasterDataPrincipal } from "@/lib/tenant-master-data-access";

export const SCHOOL_LOGO_MAX_BYTES = 2 * 1024 * 1024;

export type SchoolAssetRecord = Readonly<{
  id: string;
  tenantId: string;
  storageKey: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  byteSize: number;
  width: number;
  height: number;
  createdByUserId: string;
  createdAt: Date;
}>;

export interface SchoolAssetStorage {
  write(tenantId: string, key: string, bytes: Uint8Array): Promise<void>;
  read(tenantId: string, key: string): Promise<Uint8Array>;
  remove(tenantId: string, key: string): Promise<void>;
}

export interface SchoolAssetTransaction {
  findCurrentLogo(tenantId: string): Promise<SchoolAssetRecord | null>;
  saveLogo(asset: SchoolAssetRecord): Promise<void>;
}

export interface SchoolAssetStore {
  transaction<T>(work: (transaction: SchoolAssetTransaction) => Promise<T>): Promise<T>;
}

function tenantKey(tenantId: string, key: string) {
  const prefix = `tenants/${tenantId}/`;
  if (!key.startsWith(prefix) || key.includes("..") || key.includes("\\")) throw new Error("Asset not found");
}

export function createInMemorySchoolAssetStorage(): SchoolAssetStorage {
  const objects = new Map<string, Uint8Array>();
  return {
    async write(tenantId, key, bytes) { tenantKey(tenantId, key); objects.set(key, bytes.slice()); },
    async read(tenantId, key) {
      tenantKey(tenantId, key);
      const value = objects.get(key);
      if (!value) throw new Error("Asset not found");
      return value.slice();
    },
    async remove(tenantId, key) { tenantKey(tenantId, key); objects.delete(key); },
  };
}

function pngDimensions(bytes: Uint8Array) {
  if (bytes.length < 24 || ![137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { mimeType: "image/png" as const, width: view.getUint32(16), height: view.getUint32(20) };
}

function jpegDimensions(bytes: Uint8Array) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) { offset += 1; continue; }
    const marker = bytes[offset + 1];
    if (marker === 0xd9 || marker === 0xda) break;
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (length < 2 || offset + length + 2 > bytes.length) break;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return { mimeType: "image/jpeg" as const, height: (bytes[offset + 5] << 8) | bytes[offset + 6], width: (bytes[offset + 7] << 8) | bytes[offset + 8] };
    }
    offset += length + 2;
  }
  return null;
}

function webpDimensions(bytes: Uint8Array) {
  const text = (start: number, length: number) => String.fromCharCode(...bytes.slice(start, start + length));
  if (bytes.length < 30 || text(0, 4) !== "RIFF" || text(8, 4) !== "WEBP") return null;
  const chunk = text(12, 4);
  if (chunk === "VP8X") return { mimeType: "image/webp" as const, width: 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16), height: 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16) };
  if (chunk === "VP8L" && bytes[20] === 0x2f) {
    const bits = bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24);
    return { mimeType: "image/webp" as const, width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  return null;
}

export function inspectSchoolLogo(bytes: Uint8Array, maxBytes = SCHOOL_LOGO_MAX_BYTES) {
  if (bytes.byteLength > maxBytes) throw new Error("Ukuran logo maksimal 2 MB.");
  const inspected = pngDimensions(bytes) ?? jpegDimensions(bytes) ?? webpDimensions(bytes);
  if (!inspected) throw new Error("Logo harus berisi file JPEG, PNG, atau WebP yang valid.");
  if (inspected.width < 256 || inspected.height < 256) throw new Error("Logo minimal berukuran 256 x 256 piksel.");
  if (inspected.width !== inspected.height) throw new Error("Logo harus persegi; pilih crop persegi sebelum mengunggah.");
  return inspected;
}

const extensions = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" } as const;

export function createUploadSchoolLogoCommand(dependencies: {
  storage: SchoolAssetStorage;
  store: SchoolAssetStore;
  retentionDays: number | null;
  id?: () => string;
  now?: () => Date;
}) {
  const id = dependencies.id ?? (() => crypto.randomUUID());
  const now = dependencies.now ?? (() => new Date());
  return async (principal: MasterDataPrincipal, input: { bytes: Uint8Array; fileName: string; declaredMimeType: string }) => {
    if (!dependencies.retentionDays || dependencies.retentionDays < 1) return { ok: false, code: "retention-not-configured" } as const;
    let inspected: ReturnType<typeof inspectSchoolLogo>;
    try { inspected = inspectSchoolLogo(input.bytes); }
    catch (error) { return { ok: false, code: "invalid-file", message: error instanceof Error ? error.message : "Logo tidak valid." } as const; }
    const assetId = id();
    const storageKey = `tenants/${principal.tenantId}/school-profile/logo/${assetId}.${extensions[inspected.mimeType]}`;
    const asset: SchoolAssetRecord = { id: assetId, tenantId: principal.tenantId, storageKey, ...inspected, byteSize: input.bytes.byteLength, createdByUserId: principal.userId, createdAt: now() };
    await dependencies.storage.write(principal.tenantId, storageKey, input.bytes);
    try {
      await dependencies.store.transaction(async (transaction) => transaction.saveLogo(asset));
    } catch (error) {
      await dependencies.storage.remove(principal.tenantId, storageKey).catch(() => undefined);
      throw error;
    }
    return { ok: true, asset } as const;
  };
}
