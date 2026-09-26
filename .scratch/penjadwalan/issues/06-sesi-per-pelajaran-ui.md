# 06 — Sesi per pelajaran: UI Absensi Kelas & permission Guru

**What to build:** Rombak halaman Absensi Kelas ke sudut pandang **per Guru** (default
login Guru: daftar pelajarannya hari ini dari jadwal), dengan toggle **per Rombongan
Belajar** untuk School Admin; perkenalkan permission Guru untuk mencatat kehadiran.

**Blocked by:** 05

**Status:** ready-for-agent

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

- [ ] Halaman Absensi Kelas: tampilan per Guru (default untuk Guru) + toggle per Rombel
      (School Admin).
- [ ] Guru hanya melihat/mencatat pelajarannya sendiri; penolakan server-side teruji
      (Guru lain tidak bisa menulis record sesi yang bukan miliknya).
- [ ] Aksi buka/tutup manual (koreksi) dengan loader; auto-alpa terlihat saat tutup.
- [ ] Permission + operasi baru Guru masuk rbac contract + coverage; Template Role
      Tenant diperbarui.
- [ ] Loader pada semua aksi yang menunggu proses.
- [ ] `pnpm typecheck`, tes fokus, `pnpm rbac:coverage` hijau.

## Catatan keamanan

- Input pengguna + data siswa + otorisasi per baris → konsultasikan `/code-security`.
