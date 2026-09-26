# rbac:coverage — RBAC Entry Point Coverage

Usaha kecil repo-wide untuk membuat `pnpm rbac:coverage` kembali hijau: setiap
entry point (halaman/server action) yang ditemukan skrip coverage harus terpetakan
di operation map dengan permission/gate/classification yang benar.

## Notes

- Skrip: `scripts/check-tenant-rbac-coverage.ts` → memanggil
  `checkTenantAuthorizationCoverage` (`lib/authorization/tenant-rbac-coverage.ts`),
  exit 1 bila ada issue.
- **Status 2026-09-27: selesai.** `pnpm rbac:coverage` hijau (195/195 mapped,
  issues kosong), `OPERATION_MAP_VERSION` naik ke `tenant-operations@5`.
- Koordinasi dengan Penjadwalan: grup `absensi/settings/schedule` dipetakan ke
  guard nyatanya hari ini (`absensi.settings.save`); **slice 07 Penjadwalan** akan
  memindahkan 3 baris entry point ke operasi `jadwal.sekolah.*` saat relokasi ke
  `/jadwal/sekolah` (tiket: `.scratch/penjadwalan/issues/07-relokasi-jadwal-sekolah.md`).

## Out of scope

- Mengubah semantik skrip coverage atau cara kerja evaluator otorisasi.
- Membuat permission baru di luar kebutuhan pemetaan yang jujur per grup entry point.
