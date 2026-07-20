# 19 — Download dan validasi template impor

**What to build:** Sediakan template `.xlsx` terpisah untuk Siswa, Guru, dan Staf serta upload yang membuat Batch Impor Orang dan Revisi Impor melalui durable validation job tanpa menulis Master Data.

**Blocked by:** 11 — Kelola Warga Sekolah yang memiliki beberapa profil.

**Status:** ready-for-agent

- [ ] Template Siswa, Guru, dan Staf dibuat dari validation contract yang sama dengan server.
- [ ] Workbook memiliki sheet `Petunjuk`, `Data`, dan protected `Referensi`, machine-readable entity type, serta semantic version.
- [ ] Identifier cells memakai text dan instruksi tanggal memakai `YYYY-MM-DD`.
- [ ] Download mengikuti School Admin, Tenant lifecycle, dan import-download feature flag.
- [ ] Upload maksimal 10 MB dan 5.000 data rows; type tidak ditentukan dari filename.
- [ ] Password protection, macro, formula, external link, embedded image, corruption, unsupported version, dan ambiguous structure ditolak.
- [ ] Upload menyimpan protected Tenant-scoped file dan membuat batch; validation berjalan sebagai durable job.
- [ ] Validation menghasilkan immutable revision dan row findings `Siap`, `Peringatan`, atau `Ditolak` tanpa menulis Warga Sekolah/profile/account.
- [ ] Job dapat dilanjutkan setelah restart, tidak diproses ganda oleh dua worker, dan tidak memasukkan cell payload ke generic logs.
- [ ] Template, parser, storage contract, authorization, worker claim/retry, MySQL ownership, dan no-Master-Data-write memiliki test.
