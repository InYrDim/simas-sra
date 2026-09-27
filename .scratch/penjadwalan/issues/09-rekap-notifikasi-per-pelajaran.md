# 09 — Dampak Penjadwalan ke Riwayat Absensi, rekap, dan notifikasi WhatsApp per pelajaran

**What to build:** Setelah sesi Absensi Kelas berjalan **per pelajaran** (tiket 05–06),
lapisan konsumen downstream belum mengikutinya: **Riwayat Absensi**, **rekap**, dan
**notifikasi WhatsApp** masih berbasis model lama (satu sesi per lapisan per hari).
Selaraskan ketiganya dengan model per-slot: rekap per mata pelajaran, konsistensi
status alpa otomatis, dan notifikasi per pelajaran kepada wali.

**Blocked by:** None (tiket 05 & 06 sudah resolved).

**Status:** needs-triage

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

## Acceptance criteria

- [ ] Keputusan diambil per pilihan di atas dan terekam di wayfinder/map.md.
- [ ] Riwayat Absensi menampilkan sesi per pelajaran tanpa merusak tampilan lapisan
      Gerbang.
- [ ] Rekap konsisten dengan model per-slot (tidak ada status yang hilang/dobel hitung).
- [ ] Notifikasi WhatsApp per pelajaran dirancang (pemicu, isi, penerima, dedup) —
      implementasi bisa jadi tiket lanjutan terpisah.
- [ ] Test untuk query riwayat/rekap baru + regresi lapisan Gerbang.

## Comments
