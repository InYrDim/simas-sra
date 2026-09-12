# 04 — RBAC & feature-gate untuk operasi rekam

Type: task
Status: ready-for-agent
Blocked by: 01

## Brief

Daftarkan operasi & permission rekam Gerbang/Kelas di kontrak RBAC dan registry fitur,
serta petakan entry point agar coverage test (`pnpm rbac:coverage`) tetap hijau.

## Acceptance

- `config/tenant-features.ts`: tambah `absensiGerbang.record` / `absensiKelas.record`?
  > Keputusan: cukup gunakan gate lapisan yang sudah ada (`absensiGerbang`/`absensiKelas`)
  > + permission `absensi.gerbang.record` / `absensi.kelas.record`. Tidak perlu key fitur baru.
- `lib/authorization/tenant-rbac-contract.ts`:
  - seed operation `absensi.gerbang.record` (permissions [`absensi.gerbang.record`], gate write)
  - seed operation `absensi.kelas.record` (permissions [`absensi.kelas.record`], gate write)
  - entry point: action `recordGerbangAction`/`recordKelasAction` + halaman gerbang/kelas
    (legacy `["entitlement"]` untuk page)
- `lib/authorization/tenant-rbac-contract.test.ts`: perbarui count (157 → 159 seeds + reserved).
- Jalankan `pnpm rbac:coverage` → hijau.

## Comments
