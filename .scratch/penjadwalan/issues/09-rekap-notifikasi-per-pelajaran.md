# 09 — Dampak Penjadwalan ke Riwayat Absensi, rekap, dan notifikasi WhatsApp per pelajaran

**What to build:** Setelah sesi Absensi Kelas berjalan **per pelajaran** (tiket 05–06),
lapisan konsumen downstream belum mengikutinya: **Riwayat Absensi**, **rekap**, dan
**notifikasi WhatsApp** masih berbasis model lama (satu sesi per lapisan per hari).
Selaraskan ketiganya dengan model per-slot: rekap per mata pelajaran, konsistensi
status alpa otomatis, dan notifikasi per pelajaran kepada wali.

**Blocked by:** None (tiket 05 & 06 sudah resolved).

**Status:** ready-for-agent (keputusan lengkap — lihat wayfinder 07)

## Konteks keputusan yang sudah ada

- Sesi Kelas kini unik per (slot, tanggal) dengan idempotensi open/close per slot id;
  penutupan memicu **auto-alpa transaksional** atas siswa tanpa record, actor sistem
  dengan `recorded_by_user_id` NULL.
- `attendance_session` dulu unik per (Tenant, lapisan, tanggal) — sudah diganti untuk
  lapisan Kelas via migrasi destruktif; **belum ada data produksi**.
- Wali menerima absensi harian Gerbang via WhatsApp (lapisan Gerbang); format per
  pelajaran belum ada.
- Guard hapus slot nyata memakai `sessionCountsBySlotId`; sesi/record immutable;
  koreksi hanya lewat aksi open/close/delete yang terguard `assertKelasSessionWriteAccess`.

## Pertanyaan desain yang harus dijawab

- Riwayat & rekap: tampil per sesi/pelajaran (waktu, mapel, guru) atau tetap agregat
  harian dengan detail expand? Perlu perubahan query apa di `lib/attendance/*`?
- Rekap wali/guru: metrik baru (kehadiran per mapel per semester) atau tetap harian?
- Notifikasi WhatsApp: dikirim kapan (saat sesi ditutup?), isi apa (mapel + jam +
  status), kepada siapa (wali dari rombel di slot), dan bagaimana dedup dengan
  pesan Gerbang harian yang sudah ada?
- Apakah auto-alpa sistem perlu terlihat berbeda dari alpa manual di rekap?
- Toleransi penutupan (dari Pengaturan Absensi) — tetap satu setelan global atau per
  lapisan?

## Keputusan (wayfinder 07, 2026-09-28)

- **Riwayat per sesi**: tiap sesi Kelas = satu baris dengan konteks slot (jam, Mapel,
  Guru, Rombel); Gerbang tak berubah.
- **Rekap**: konteks per pelajaran di semua tampilan record Kelas **+ agregat kehadiran
  per mapel per semester** (bagian agregat menunggu/toleran terhadap atribusi guru dari
  tiket 10).
- **Notifikasi WA model C**: record manual kirim langsung; saat penutupan hanya siswa
  belum-tercatat (alpa sistem) yang dikirim; placeholder baru `{mapel}` `{jam}` `{guru}`;
  pesan Gerbang & Kelas tetap terpisah (dedup = tidak dobel kirim siswa yang sudah
  tercatat).
- **Badge "Otomatis"** pada alpa sistem (`recordedByUserId` NULL) di Riwayat & rekap,
  hanya untuk Guru/Admin.
- **Toleransi tetap global** per tenant (tidak per slot).

Detail & implikasi teknis: `./.wayfinder/07-rekap-notifikasi-per-pelajaran.md`.

## Acceptance criteria

- [x] Keputusan diambil per pilihan di atas dan terekam di wayfinder/map.md.
- [x] Riwayat Absensi menampilkan sesi per pelajaran tanpa merusak tampilan lapisan
      Gerbang (kolom Pelajaran: mapel + jam slot + guru; Gerbang tetap "—").
- [x] Rekap konsisten dengan model per-slot + agregat per mapel per semester
      (tabel di Riwayat + ringkasan di Absensi Saya; hanya sesi ber-slot, flag
      semester slot = semester aktif, tanggal sesi dalam rentang semester).
- [x] Notifikasi WhatsApp per pelajaran: pemicu model C (manual/QR kirim langsung
      dengan `{mapel}` `{jam}` `{guru}`; saat close hanya siswa belum-tercatat yang
      dikirim via `notifyKelasAutoAlpaOnClose`, worker + close manual).
- [x] Badge alpa otomatis terlihat untuk Guru/Admin (`recordedByUserId` NULL → chip
      "Otomatis" di detail sesi Riwayat).
- [x] Test: notify 14/14, kelas-schedule + config 26/26 hijau; typecheck bersih
      (baseline MySQL-test saja). Catatan: query rekap/konteks baru (Postgres) belum
      punya test integrasi DB — tambahkan saat menyentuh area ini lagi (pola
      celah slice 05).## Comments

- 2026-09-28: runtime error saat render Riwayat di Postgres — sisa sintaks MySQL
  (`year()`/`cast(... as char)` di filter Tahun Masuk, `cast(count(... ) as unsigned)`
  di `listAttendanceSessions`). Keduanya dikonversi ke Postgres (`extract(year from …)`
  + `::text`, `cast(... as int)`). Audit pola MySQL lain (`as unsigned/char/signed`,
  `DATE_FORMAT`, `GROUP_CONCAT`, `IFNULL`, `ON DUPLICATE`, `INSERT IGNORE`, `year()`)
  di `app/` + `lib/` aktif: bersih. Sisa MySQL yang masih ada sengaja dipertahankan:
  mirror `db/schema.mysql.ts`, test `*.mysql.test.ts` + skrip `db:*:mysql` + backup
  `drizzle.mysql.backup/` (arsip masa transisi; bukan jalur runtime).
