# 06 — Sesi per pelajaran: UI Absensi Kelas & permission Guru

**What to build:** Rombak halaman Absensi Kelas ke sudut pandang **per Guru** (default
login Guru: daftar pelajarannya hari ini dari jadwal), dengan toggle **per Rombongan
Belajar** untuk School Admin; perkenalkan permission Guru untuk mencatat kehadiran.

**Blocked by:** 05

**Status:** resolved

## Keputusan yang mengikat (dari tiket 04)

- Pencatat: **Guru pengampu** pelajaran itu + **School Admin** (koreksi semua sesi);
  Wali Kelas hanya melihat. Guru butuh **baca jadwalnya sendiri** + permission **tulis
  record Kelas**; operasi/permission baru masuk rbac contract + coverage.
- Buka/tutup manual untuk koreksi tetap tersedia (tutup lebih awal, buka manual di
  luar jendela) di samping otomatis worker dari slice 05.
- Tampilan: daftar pelajaran hari ini per Guru (jam, Mapel, Rombel, status sesi);
  Admin dapat beralih ke sudut pandang Rombel. Riwayat per pelajaran mengalir dari
  sesi yang ada; **Riwayat lama hanya Gerbang** (efek migrasi slice 05).
- Auto-alpa sudah terjadi di backend; UI menampilkan status tercatat/belum per siswa.

## Acceptance criteria

- [x] Halaman Absensi Kelas: tampilan per Guru (default untuk Guru) + toggle Per Guru /
      Per Rombel untuk School Admin (`?view=guru|rombel`; Admin default Per Rombel).
- [x] Guru hanya melihat/mencatat pelajarannya sendiri: penolakan server-side via
      contextual policy `assigned-or-self` (operasi baru `absensi.kelas.load`) + guard
      baris `assertKelasSessionWriteAccess` (pengampu atau School Admin) di SEMUA action
      tulis — record/close/delete/open. Catatan: penolakan baru terverifikasi lewat
      kontrak + tsc (belum test mysql end-to-end, sejalan celah slice 05).
- [x] Aksi buka/tutup manual (koreksi) dengan loader (Spinner); auto-alpa tereksekusi
      server saat tutup; form record dinonaktifkan pada sesi closed.
- [x] Operasi `absensi.kelas.load` (assigned-or-self) + `jadwal.mengajar.load` dibuka ke
      guru (assigned-or-self) di rbac contract (tetap `tenant-operations@6`, digest baru
      teradopsi ke DB dev via adopt script); coverage 209/209. Template "guru" dan
      "wali-kelas" sudah memuat `absensi.attendance.view` (kunci operasi baru); menu
      sidebar "Absensi → Kelas" ditambahkan.
- [x] Loader pada semua aksi yang menunggu proses (useActionState + Spinner, pola existing).
- [x] `pnpm typecheck` bersih (non-baseline); tes fokus hijau (contract 12/12, backfill
      10/10, kelas-schedule 6/6); `pnpm rbac:coverage` 209/209 tanpa issues; set kegagalan
      `pnpm test:unit` identik baseline (13 fail pra-eksisting).

## Catatan implementasi

- `lib/attendance/attendance-kelas-access.ts` (baru): `enforceKelasAttendancePageAccess`
  (policy assigned-or-self dengan fallback homeroom baca-only) +
  `assertKelasSessionWriteAccess` (guard baris pengampu/admin, fail closed) +
  `buildKelasPrincipal`.
- Data layer: view sesi kini membawa `teacherProfileId`; helper homeroom
  `listHomeroomClassGroupIdsForUser` untuk sudut pandang Wali Kelas (read-only).
- Wali Kelas (bukan pengampu, bukan admin): melihat sesi rombelnya tanpa aksi tulis
  (keputusan user: baca-only rombelnya); halaman menandai "Lihat".
- Keputusan desain dikonfirmasi user: contextual policy assigned-or-self (pola
  `students.load`/quiz), bukan guard manual; wali kelas baca-only di slice ini.

## Catatan keamanan

- Input pengguna + data siswa + otorisasi per baris → konsultasikan `/code-security`.
