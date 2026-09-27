# 07 — Relokasi Jadwal Sekolah ke menu Penjadwalan

**What to build:** Pindahkan halaman pengaturan **Jadwal Sekolah** (jam masuk/pulang
per hari efektif + hari libur) dari Pengaturan Absensi ke menu Penjadwalan sebagai
submenu **Jadwal Sekolah** (`/jadwal/sekolah`). Worker Gerbang tidak berubah sama
sekali.

**Blocked by:** None (independen; disarankan setelah 04 agar menu Penjadwalan sudah
berisi konten selain placeholder).

**Status:** resolved

## Keputusan yang mengikat (dari tiket 06)

- Rute lama `/absensi/settings/schedule` **dihapus tanpa redirect**; kartu "Jadwal
  Sekolah (Gerbang)" di hub Pengaturan Absensi dihapus; `revalidatePath` diarahkan ke
  path baru.
- Halaman **tetap digate `absensiGerbang`** (gate mengikuti pemilik data): mematikan
  fitur Penjadwalan tidak mengunci konfigurasi Gerbang. Item menu di bawah Penjadwalan
  dengan feature `absensiGerbang`.
- Operasi **baru `jadwal.sekolah.*`** + permission baru menggantikan
  `absensi.settings.save` → `absensi.settings.update` di halaman ini.
- **Grant otomatis sekali jalan** ke role yang memuat `absensi.settings.update`;
  **Template Role Tenant diperbarui** — akses School Admin tidak berubah, tidak ada
  kehilangan akses diam-diam.
- Submenu berlabel "Jadwal Sekolah"; halaman menjelaskan bahwa jadwal ini dipakai
  absensi Gerbang. Istilah kanonik "Jadwal Sekolah" sudah ada di `CONTEXT.md`.

## Acceptance criteria

- [x] Halaman `/jadwal/sekolah` berfungsi penuh (form hari efektif + hari libur),
      digate `absensiGerbang`, operasi `jadwal.sekolah.*`.
- [x] Halaman + kartu lama dihapus; tidak ada referensi path lama yang tersisa;
      `revalidatePath` mengarah ke path baru.
- [x] Item menu baru di bawah Penjadwalan dengan feature `absensiGerbang`; ikon gembok/
      tooltip saat Gerbang dimatikan Provider.
- [x] Migration grant sekali jalan + update Template Role Tenant; test: role yang
      tadinya punya `absensi.settings.update` mendapat permission baru.
- [x] Entrypoint RBAC baru masuk rbac contract + coverage.
- [x] `pnpm typecheck`, tes fokus, `pnpm rbac:coverage` hijau.

## Catatan implementasi

- **RBAC**: permission baru `jadwal.sekolah.view` + `jadwal.sekolah.update`
  (registry 171→173), module metadata `sekolah: "Jadwal Sekolah"`. Operasi baru
  `jadwal.sekolah.load` (page `jadwal/sekolah`) dan `jadwal.sekolah.save` (3 action),
  keduanya `school-admin-only`. Entry point lama dihapus dari `absensi.settings.save`.
  `OPERATION_MAP_VERSION` → `tenant-operations@7`; dev DB sudah adopt (`--execute`,
  script `adopt-tenant-rbac-map-version.ts`).
- **Halaman**: `app/(tenant)/[domain]/(authenticated)/absensi/settings/schedule/`
  dipindah via `git mv` ke `jadwal/sekolah/` (page, actions, gerbang-schedule-form).
  Page baru: gate `absensiGerbang`, op `jadwal.sekolah.load`, judul "Jadwal Sekolah",
  back ke `/jadwal/mengajar`, penjelasan bahwa jadwal dipakai absensi Gerbang.
  Actions: 3 action → op `jadwal.sekolah.save`; `revalidatePath` ke
  `/{domain}/jadwal/sekolah` (+ `/absensi/gerbang` tetap, karena Gerbang membaca data
  ini). Kartu hub lama di `absensi/settings/page.tsx` dihapus. Sisa referensi path lama
  hanya komentar historis di `jadwal/sekolah/page.tsx`.
- **Menu**: sub-item `jadwal-sekolah` di bawah Penjadwalan
  (`requiredPermissions: ["jadwal.sekolah.view"]`, `feature: "absensiGerbang"`).
  `TenantNavCollapsibleItem` diperluas menerima `features` → gate feature per
  sub-item: subDisabled → `opacity-45`, ikon `LockKeyhole`, title tooltip
  "dinonaktifkan oleh Provider", render `<span>` bukan Link.
- **Template role**: template `pimpinan` + `jadwal.sekolah.view`/`jadwal.sekolah.update`.
- **Grant sekali jalan**: `scripts/grant-jadwal-sekolah.ts` idempotent — insert kedua
  permission ke role pemilik `absensi.settings.update`; mode `verify` exit 1 bila
  masih pending; validasi terhadap registry assignable. Dijalankan di dev DB:
  `rolesScanned: 0, granted: 0, ok: true` (belum ada role custom dengan key lama);
  verify OK.
- **Verifikasi**: `tsc` bersih (non-baseline), `pnpm rbac:coverage` 209/209 tanpa
  issues, contract test `tenant-rbac-contract.test.ts` 12/12 (@7, registry 173),
  `legacy-non-admin-backfill.test.ts` 10/10 (assert map version @7), `pnpm test:unit`
  1076 tests / 1063 pass / 13 fail = baseline pra-eksisting.
