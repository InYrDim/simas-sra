# 05 — Sesi per pelajaran: backend (migrasi + worker)

**What to build:** Ubah `attendance_session` agar lapisan Kelas terikat Slot Jadwal,
lakukan migrasi destruktif data lama, perluas worker untuk sesi per pelajaran, dan
tambahkan toleransi penutupan + alpa otomatis. Belum ada perubahan UI.

**Blocked by:** 04

**Status:** resolved

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

- [x] Migration: skema baru + pembersihan data Kelas lama (`20260927033807_strange_beyonder`, DELETE destruktif
      di awal; tambahan `20260927061413_kelas_record_system_actor` menjadikan `recorded_by_user_id` nullable
      untuk actor sistem).
- [x] Keputusan jadwal Kelas murni + unit test (`attendance-kelas-schedule.ts`, 6/6 hijau — termasuk
      `pickKelasSessionByWindow` untuk pemilihan sesi berbasis jendela).
- [x] Worker membuka/menutup sesi per slot; recheck fitur; idempotent (`scripts/run-attendance-schedule-worker.ts`
      + `processTenantKelas`; gate `tenantAllowsKelasSessions` = `penjadwalan` + `absensiKelas`; libur menekan semua slot).
- [x] Auto-alpa saat penutupan (worker & manual) — actor sistem = `recordedByUserId NULL` (pola
      `openedByUserId NULL`); `closeKelasSlotSession` transaksional (isi siswa rombel aktif yang belum
      tercatat, lalu tutup); close manual `closeKelasSessionById` lewat action memakai jalur yang sama.
- [x] Guard hapus slot dengan sesi: `sessionCountsBySlotId` menghitung `attendance_session.slot_id` nyata;
      validasi penugasan aktif saat buka sesi (`listEffectiveKelasSlotsForDate` + `resolveKelasSlotDecision`).
- [x] Pengaturan toleransi tersimpan di Pengaturan Absensi (per Tenant): `kelasCloseToleranceMinutes`
      + UI `absensi/settings/kelas` + action `saveKelasCloseToleranceAction`.
- [x] `pnpm typecheck` bersih (non-baseline); tes fokus hijau; `pnpm rbac:coverage` 209/209 terpetakan
      (peta `tenant-operations@6`, sudah `adopt`); set kegagalan `pnpm test:unit` identik dengan baseline.

## Catatan implementasi

> **Celah dikenal (untuk slice berikutnya):** jalur DB (buka/tutup sesi per slot + auto-alpa saat
> penutupan) belum punya test integrasi MySQL — keputusan murni teruji penuh (6/6), verifikasi DB
> baru lewat tsc + smoke run worker. Tambahkan test ala `*.mysql.test.ts` saat menyentuh area ini
> lagi (usul: mock store pattern `teaching-slot-service.test.ts` atau test mysql sungguhan).

- `lib/attendance/attendance-kelas-data.ts` (baru, server-only): daftar slot efektif per tanggal
  (join penugasan, filter `active` + `startsOn ≤ d < endsOn`), buka/tutup sesi per slot idempotent,
  auto-alpa transaksional, gate fitur, view sesi+konteks (mapel/kelas/guru) untuk halaman.
- `recordAttendance` menerima `sessionId` opsional (validasi tenant+layer scoped, fail closed ke
  record tanpa sesi); tanpa `sessionId`, pemilihan sesi Kelas memakai `pickKelasSessionByWindow`
  (jendela memuat waktu sekarang; overlap → jendela terawal). Gerbang tetap satu sesi per hari.
- Halaman `absensi/kelas` dirombak ke daftar sesi per slot (KelasSlotList, pilih via `?sessionId=`);
  panel sesi harian lama (`kelas-session-panel.tsx`) dihapus; `openKelasSessionAction` kini menerima
  `slotId` dan membuka sesi manual per slot (window dari slot + toleransi, `openedByUserId` terisi).
- Catatan dev worker: jalankan dengan `NODE_OPTIONS=--conditions=react-server` (konvensi repo) dan
  `void main().then(...)` alih-alih top-level await (script berjalan sebagai CJS).

## Catatan keamanan

- Menyentuh data siswa + query DB → konsultasikan `/code-security` saat implementasi.
