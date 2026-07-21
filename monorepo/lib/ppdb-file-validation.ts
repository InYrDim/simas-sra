import type { ProtectedFileScanner } from "@/lib/protected-file-storage"

export const PPDB_FILE_MAX_MB = 2
export const PPDB_FILE_MAX_BYTES = PPDB_FILE_MAX_MB * 1024 * 1024

export function validatePpdbFileSize(size: number): string | null {
  if (size > 0 && size <= PPDB_FILE_MAX_BYTES) return null
  if (size === 0) return "File tidak boleh kosong."
  return `Ukuran file tidak boleh lebih dari ${PPDB_FILE_MAX_MB} MB.`
}

export type PpdbDocumentFormat = Readonly<{
  mimeType: "application/pdf" | "image/jpeg" | "image/png"
  extension: "pdf" | "jpg" | "png"
}>

function startsWith(bytes: Uint8Array, signature: readonly number[]) {
  return bytes.length >= signature.length && signature.every((byte, index) => bytes[index] === byte)
}

export function inspectPpdbDocument(bytes: Uint8Array): PpdbDocumentFormat | null {
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return { mimeType: "application/pdf", extension: "pdf" }
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return { mimeType: "image/jpeg", extension: "jpg" }
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mimeType: "image/png", extension: "png" }
  return null
}

// Scanner sementara: hanya memverifikasi signature format, belum mendeteksi malware.
export const ppdbDocumentSignatureScanner: ProtectedFileScanner = {
  async scan({ bytes }) {
    return inspectPpdbDocument(bytes)
      ? { status: "clean" }
      : { status: "rejected", code: "unsupported-signature" }
  },
}
