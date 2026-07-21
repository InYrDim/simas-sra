# 03 — Kelola data dasar Profil Sekolah

**What to build:** Ubah placeholder Profil Sekolah menjadi halaman yang menampilkan identitas resmi dari Provider dan memungkinkan School Admin mengubah data operasional sekolah dengan aman.

**Blocked by:** 01 — Lindungi seluruh area Master Data; 02 — Sediakan pola halaman Master Data yang konsisten.

**Status:** resolved

- [x] Setiap Tenant memiliki tepat satu Profil Sekolah yang dibuat secara lazy atau bootstrap idempotent.
- [x] NPSN, Nama Resmi Sekolah, education level, dan domain dibaca dari sumber Provider dan tampil read-only.
- [x] School Admin dapat menyimpan nama tampilan, alamat terstruktur, email/telepon institusi, website HTTPS, koordinat, dan deskripsi plain text.
- [x] Input yang menyertakan field Provider ditolak, bukan diabaikan diam-diam.
- [x] Nilai provisioning hanya disalin jika provenance-nya diketahui; field yang tidak diketahui tetap kosong.
- [x] Halaman menunjukkan field wajib dan rekomendasi yang belum lengkap.
- [x] Update memakai version/concurrency check; stale update ditolak dan input user tetap tersedia.
- [x] Mutation dan audit tersimpan dalam satu transaksi.
- [x] Cross-Tenant read/write, invalid input, concurrent update, dan MySQL rollback memiliki test.

## Answer

Profil Sekolah kini memakai profil operasional tunggal per Tenant yang dibuat lazy dan idempotent. Identitas resmi tetap dibaca dari Provider, sementara field operasional divalidasi melalui allowlist, disimpan dengan optimistic concurrency, dan diaudit dalam transaksi yang sama. Halaman mempertahankan input saat validasi atau konflik dan menampilkan kelengkapan wajib serta rekomendasi. Migrasi `20260720063330_add-school-profile` bersifat additive; unit, akses, accessibility, real-MySQL, typecheck, dan lint terfokus lulus.
