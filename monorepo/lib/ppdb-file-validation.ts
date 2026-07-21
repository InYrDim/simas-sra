export const PPDB_FILE_MAX_MB = 2
export const PPDB_FILE_MAX_BYTES = PPDB_FILE_MAX_MB * 1024 * 1024

export function validatePpdbFileSize(size: number): string | null {
  if (size <= PPDB_FILE_MAX_BYTES) return null
  return `Ukuran file tidak boleh lebih dari ${PPDB_FILE_MAX_MB} MB.`
}
