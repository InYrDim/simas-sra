export type PenugasanResultCode = { ok: boolean; message: string };

const messages: Record<string, PenugasanResultCode> = {
  created: { ok: true, message: "Penugasan Mengajar dibuat sebagai direncanakan." },
  updated: { ok: true, message: "Penugasan direncanakan diperbarui." },
  activated: { ok: true, message: "Penugasan Mengajar diaktifkan." },
  ended: { ok: true, message: "Penugasan Mengajar diakhiri." },
  cancelled: { ok: true, message: "Penugasan Mengajar dibatalkan." },
  replaced: { ok: true, message: "Guru pengampu diganti; penugasan baru dibuat aktif." },
  "invalid-input": { ok: false, message: "Masukan tidak valid — periksa isian form." },
  "invalid-endpoint": { ok: false, message: "Data Guru/Mapel/Rombel/Tahun Ajaran tidak memenuhi syarat (aktif, tidak diarsipkan, dan selaras jenjang)." },
  "invalid-lifecycle": { ok: false, message: "Transisi status tidak diizinkan untuk penugasan ini." },
  overlap: { ok: false, message: "Sudah ada penugasan lain untuk kombinasi Guru+Mapel+Rombel+Tahun Ajaran yang waktunya tumpang tindih." },
  conflict: { ok: false, message: "Data berubah di tempat lain — muat ulang halaman lalu coba lagi." },
  "not-found": { ok: false, message: "Penugasan tidak ditemukan." },
  "read-only": { ok: false, message: "Tenant dalam keadaan baca-saja; perubahan ditolak." },
  error: { ok: false, message: "Terjadi kesalahan tak terduga — coba lagi." },
};

export function penugasanResult(result?: string): PenugasanResultCode | null {
  if (!result) return null;
  return messages[result] ?? { ok: false, message: `Hasil tidak dikenal: ${result}` };
}
