# Penjadwalan — Wayfinding Map

## Destination

Absensi Kelas berjalan **per pelajaran**: setiap sesi mencatat kehadiran untuk satu Rombongan
Belajar + Mata Pelajaran + Guru sesuai **Jadwal Mengajar** mingguan yang dikelola School Admin
di menu Penjadwalan, dengan kendali Provider per Tenant.

## Notes

- Domain: Penjadwalan Tenant SIMAS. Istilah kanonik ada di `CONTEXT.md` — kini termasuk
  **Jadwal Mengajar** dan **Slot Jadwal**.
- **Penugasan Mengajar** tetap efektif-dated dan **tidak** memuat jadwal — Slot Jadwal
  merujuk padanya; sesi Absensi Kelas merujuk Slot Jadwal.
- Penjadwalan adalah fitur Tenant-facing yang dikendalikan Provider per Tenant (keputusan
  user) → `/tenant-feature-gating` mengatur registry, hierarki, feedback UI, enforcement
  server, dan recheck worker.
- Fitur ini menyentuh input pengguna, data siswa, dan query DB → konsultasikan
  `/code-security` saat implementasi.
- Fakta kode saat ini:
  - Menu Penjadwalan sudah tampil di sidebar dengan dua submenu placeholder: Jadwal Mengajar
    (`/jadwal/mengajar`) dan Events (`/jadwal/events`). Permission menunya masih placeholder
    `tenant.authorization-audit.view`; belum ada feature key.
  - `teaching_assignment` sudah ada di DB (efektif-dated, dipakai Ulangan) tetapi belum punya
    UI pengelolaan dan belum ada penulisnya di aplikasi.
  - `attendance_session` sekarang unik per (Tenant, lapisan, tanggal): satu sesi per lapisan
    per hari; akan diganti per-slot untuk lapisan Kelas (tiket 04).
  - Lapisan Gerbang sudah otomatis lewat worker (`school_schedule_day` +
    `school_schedule_holiday`); pengaturannya masih di Pengaturan Absensi
    (`/absensi/settings/schedule`).
  - Stack: Next.js 16 App Router, Drizzle + Postgres, unit test `tsx --test`, migration via
    `drizzle-kit generate`.
- Cara kerja: satu tiket keputusan per sesi; tiket implementasi digraduasi dari
  **Not yet specified** setelah keputusan yang mengunci desainnya selesai, lalu dikerjakan
  dengan `/implement`.

## Decisions so far

- [Tetapkan ruang lingkup Penjadwalan dan model sesi Absensi Kelas](./issues/.wayfinder/01-ruang-lingkup-dan-model-sesi.md) — Penjadwalan diisi Jadwal Mengajar mingguan per Rombongan Belajar; sesi Absensi Kelas berlaku per pelajaran (banyak sesi per hari) sehingga model sesi harus berubah.
- [Tetapkan kendali Provider atas Penjadwalan](./issues/.wayfinder/02-kendali-provider.md) — Penjadwalan digate Provider per Tenant lewat feature key baru; desain dan enforcement mengikuti `/tenant-feature-gating`.
- [Tetapkan kontrak Slot Jadwal](./issues/.wayfinder/03-kontrak-slot-jadwal.md) — Slot simpan HH:MM + preset periode jam pelajaran; FK wajib ke Penugasan Mengajar aktif (repoint manual saat berakhir); ikatan Tahun Ajaran lewat penugasan + flag Semester; konflik Guru dan Rombel hard ditolak; guru pengganti dan ruang ditunda; langsung berlaku saat disimpan; hanya School Admin yang menyusun.
- [Tetapkan perilaku sesi Absensi Kelas per pelajaran](./issues/.wayfinder/04-perilaku-sesi-absensi-kelas.md) — Sesi merujuk Slot Jadwal (unik per slot+tanggal); worker otomatis + koreksi manual; Guru pengampu mencatat + Admin koreksi; sesi/record immutable, hapus slot diblokir; sesi Kelas lama dihapus (belum ada data produksi); toleransi penutupan dari Pengaturan Absensi; alpa otomatis saat sesi ditutup; tampilan default per Guru.
- [Tetapkan sumber Penugasan Mengajar](./issues/.wayfinder/05-sumber-penugasan-mengajar.md) — Dikelola di Master Data (submenu baru, tanpa feature gate, RBAC School Admin) dengan full lifecycle (planned→activate→end/cancel/replace); form slot memilih penugasan aktif + tautan ke Master Data; impor massal ditunda.
- [Tetapkan relokasi pengaturan Jadwal Sekolah](./issues/.wayfinder/06-relokasi-jadwal-sekolah.md) — Pindah ke menu Penjadwalan sebagai submenu Jadwal Sekolah; rute lama dihapus tanpa redirect; tetap digate `absensiGerbang`; operasi + permission baru `jadwal.sekolah.*` dengan grant otomatis ke role terkait; istilah kanonik dicatat di `CONTEXT.md`.

## Not yet specified

- Semua tiket keputusan (01–06) sudah selesai. Yang tersisa: **urutan slice
  implementasi** — skema slot + migration, Penugasan Mengajar di Master Data, CRUD
  Jadwal Mengajar, sesi per pelajaran + worker, relokasi UI Jadwal Sekolah, RBAC/
  feature key (tiket 01), UI + loader, dan test — lalu tiap slice dikerjakan dengan
  `/implement`.
- Detail slice Penugasan Mengajar di Master Data (layout halaman, kolom list, UX riwayat
  event) — keputusan besar sudah terkunci di tiket 05; sisanya dikerjakan saat implementasi.
- Dampak ke Riwayat Absensi, rekap, dan notifikasi WhatsApp per pelajaran.
- Cakupan submenu Events (`/jadwal/events`).

## Out of scope

- Mengubah cara kerja lapisan Gerbang dan worker Jadwal Sekolah (hanya UI pengaturannya yang
  dipertanyakan di tiket relokasi).
- Beban mengajar (jumlah jam per Guru) dan analitik jadwal.
- Penjadwalan ekstrakurikuler dan kegiatan non-pelajaran.
- Guru pengganti per tanggal pada slot (sementara lewat operasi `replaced` Penugasan Mengajar).
- Kolom ruang/lokasi pada slot (cukup Lokasi utama Rombongan Belajar).
- Rombongan Belajar gabung pada cek konflik jadwal.
- Penurunan status Kelas dari lapisan Gerbang (alpa otomatis hanya dari sesi tak tercatat).
