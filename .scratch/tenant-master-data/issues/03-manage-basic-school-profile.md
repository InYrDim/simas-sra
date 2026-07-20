# 03 — Kelola data dasar Profil Sekolah

**What to build:** Ubah placeholder Profil Sekolah menjadi halaman yang menampilkan identitas resmi dari Provider dan memungkinkan School Admin mengubah data operasional sekolah dengan aman.

**Blocked by:** 01 — Lindungi seluruh area Master Data; 02 — Sediakan pola halaman Master Data yang konsisten.

**Status:** ready-for-agent

- [ ] Setiap Tenant memiliki tepat satu Profil Sekolah yang dibuat secara lazy atau bootstrap idempotent.
- [ ] NPSN, Nama Resmi Sekolah, education level, dan domain dibaca dari sumber Provider dan tampil read-only.
- [ ] School Admin dapat menyimpan nama tampilan, alamat terstruktur, email/telepon institusi, website HTTPS, koordinat, dan deskripsi plain text.
- [ ] Input yang menyertakan field Provider ditolak, bukan diabaikan diam-diam.
- [ ] Nilai provisioning hanya disalin jika provenance-nya diketahui; field yang tidak diketahui tetap kosong.
- [ ] Halaman menunjukkan field wajib dan rekomendasi yang belum lengkap.
- [ ] Update memakai version/concurrency check; stale update ditolak dan input user tetap tersedia.
- [ ] Mutation dan audit tersimpan dalam satu transaksi.
- [ ] Cross-Tenant read/write, invalid input, concurrent update, dan MySQL rollback memiliki test.
