# 04 — CRUD Jadwal Mengajar (Slot)

**What to build:** Halaman `/jadwal/mengajar` yang sesungguhnya: School Admin menyusun
Slot Jadwal per Rombongan Belajar (buat/edit/hapus) dengan cek konflik dan pemilihan
Penugasan Mengajar aktif. Membuat feature key `penjadwalanWrite` di registry — satu-
satunya tempat yang boleh membuatnya, sesuai catatan tiket 01.

**Blocked by:** 01, 02, 03

**Status:** ready-for-agent

## Keputusan yang mengikat (dari tiket 03 + 05)

- Form slot memilih **satu Penugasan Mengajar aktif** (filter rombel/tahun/semester) +
  **tautan ke Master Data** untuk membuat baru; tidak ada pembuatan penugasan dari form.
- Konflik Guru/Rombel hard ditolak dengan pesan konflik (pakai validator slice 03).
- Slot yang sudah punya sesi **diblokir dari penghapusan** (tiket 04) — di slice ini
  belum ada sesi, tapi guard-nya dipasang sejak sekarang.
- Hanya School Admin; ganti permission menu dari placeholder ke `jadwal.mengajar.load`.
- Preset periode jam pelajaran (slice 03) dipakai mengisi jam form secara cepat.

## Acceptance criteria

- [ ] Halaman `/jadwal/mengajar`: pilih Rombongan Belajar → grid mingguan slot; buat/
      edit/hapus slot dengan loader.
- [ ] Pemilih Penugasan Mengajar aktif + link ke Master Data.
- [ ] Simpan menolak konflik dengan pesan yang menyebut pelajaran/Guru yang bentrok.
- [ ] Feature key `penjadwalanWrite` dibuat + dipakai operasi tulis; enforcement server.
- [ ] Menu + halaman terkunci (non-disclosure) bila Provider mematikan Penjadwalan.
- [ ] Tes: konflik ditolak di layer tulis; gate write; role tanpa `penjadwalanWrite`
      ditolak.
- [ ] `pnpm typecheck`, tes fokus, `pnpm rbac:coverage` hijau.
