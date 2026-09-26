# 05 — Sesi per pelajaran: backend (migrasi + worker)

**What to build:** Ubah `attendance_session` agar lapisan Kelas terikat Slot Jadwal,
lakukan migrasi destruktif data lama, perluas worker untuk sesi per pelajaran, dan
tambahkan toleransi penutupan + alpa otomatis. Belum ada perubahan UI.

**Blocked by:** 04

**Status:** ready-for-agent

## Keputusan yang mengikat (dari tiket 04)

- Identitas sesi: kolom `slotId` + `sessionDate`, unik per `(tenant, slotId, sessionDate)`
  di level DB (lapisan Gerbang tetap unik per tanggal). Guru/Mapel/Rombel mengalir dari
  slot → penugasan; validasi penugasan aktif saat membuka sesi.
- **Migrasi destruktif (sadar; belum ada data produksi):** hapus sesi lapisan Kelas
  beserta `attendance_record`-nya; buang aturan unik `(tenant, layer, sessionDate)`;
  konsep "sesi harian" hilang dari produk; Riwayat lama hanya menyisakan Gerbang.
- Worker: pola Gerbang (keputusan murni `before/during/after` + aksi worker) diperluas
  ke Kelas per slot berlaku hari itu; buka tepat jam mulai slot; tutup di akhir jendela
  + toleransi; **recheck feature key `penjadwalan`** sebelum membuka.
- Toleransi penutupan: N menit setelah `endTime` slot (Pengaturan Absensi, per Tenant;
  default usulan 10 menit) — `plannedEnd` sesi = endTime slot + toleransi.
- Alpa otomatis: saat sesi ditutup (worker atau manual), siswa belum tercatat diisi
  `alpa` oleh sistem (actor sistem, mirip pola `openedByUserId NULL`), tetap bisa
  dikoreksi.
- Sesi/record immutable; guard "hapus slot diblokir bila punya sesi" aktif di data layer.
- Tanpa penurunan status dari lapisan Gerbang di slice ini.

## Acceptance criteria

- [ ] Migration: skema baru + pembersihan data Kelas lama (teruji di migration test).
- [ ] Keputusan jadwal Kelas murni + unit test (slot berlaku, toleransi, libur/
      non-effective hari → tidak ada sesi).
- [ ] Worker membuka/menutup sesi per slot; recheck fitur; idempotent.
- [ ] Auto-alpa saat penutupan (worker & manual) + test; actor sistem tercatat.
- [ ] Guard hapus slot dengan sesi; validasi penugasan aktif saat membuka sesi.
- [ ] Pengaturan toleransi tersimpan di Pengaturan Absensi (per Tenant).
- [ ] `pnpm typecheck`, tes fokus hijau.

## Catatan keamanan

- Menyentuh data siswa + query DB → konsultasikan `/code-security` saat implementasi.
