# 07 — Relokasi Jadwal Sekolah ke menu Penjadwalan

**What to build:** Pindahkan halaman pengaturan **Jadwal Sekolah** (jam masuk/pulang
per hari efektif + hari libur) dari Pengaturan Absensi ke menu Penjadwalan sebagai
submenu **Jadwal Sekolah** (`/jadwal/sekolah`). Worker Gerbang tidak berubah sama
sekali.

**Blocked by:** None (independen; disarankan setelah 04 agar menu Penjadwalan sudah
berisi konten selain placeholder).

**Status:** ready-for-agent

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

- [ ] Halaman `/jadwal/sekolah` berfungsi penuh (form hari efektif + hari libur),
      digate `absensiGerbang`, operasi `jadwal.sekolah.*`.
- [ ] Halaman + kartu lama dihapus; tidak ada referensi path lama yang tersisa;
      `revalidatePath` mengarah ke path baru.
- [ ] Item menu baru di bawah Penjadwalan dengan feature `absensiGerbang`; ikon gembok/
      tooltip saat Gerbang dimatikan Provider.
- [ ] Migration grant sekali jalan + update Template Role Tenant; test: role yang
      tadinya punya `absensi.settings.update` mendapat permission baru.
- [ ] Entrypoint RBAC baru masuk rbac contract + coverage.
- [ ] `pnpm typecheck`, tes fokus, `pnpm rbac:coverage` hijau.
