# 02 — Penugasan Mengajar: halaman Master Data

**What to build:** Submenu baru di Master Data untuk mengelola **Penugasan Mengajar**
(Guru + Mata Pelajaran + Rombongan Belajar + Tahun Ajaran) dengan full lifecycle,
memakai modul domain existing `lib/academic/teaching-assignment.ts` — bukan logika baru.

**Blocked by:** None — can start immediately (paralel dengan 03).

**Status:** ready-for-agent

## Keputusan yang mengikat (dari tiket 05)

- Lokasi: Master Data (submenu baru), **tanpa feature gate** — RBAC School Admin saja;
  Ulangan tetap terlayani meski fitur Penjadwalan dimatikan Provider.
- Full lifecycle di UI: buat (`planned`) → Aktifkan → Akhiri / Batalkan / Ganti Guru
  (replace); semua transisi wajib alasan dan tercatat di `teaching_assignment_event`.
- Kewenangan tulis: hanya School Admin (permission tulis baru). Guru hanya konsumen
  (baca penugasannya sendiri sudah ada lewat `listEffectiveTeachingAssignmentsForUser`).
- Impor massal ditunda — tidak di tiket ini.

## Acceptance criteria

- [ ] Submenu Master Data baru + halaman list penugasan (filter Guru/Rombel/Tahun Ajaran).
- [ ] Form buat (planned) + aksi activate/end/cancel/replace dengan form alasan.
- [ ] Riwayat event penugasan tampil per penugasan.
- [ ] Operasi + permission tulis baru (School Admin) masuk rbac contract + coverage.
- [ ] Loader pada semua aksi yang menunggu proses.
- [ ] `pnpm typecheck`, tes fokus, `pnpm rbac:coverage` hijau.
