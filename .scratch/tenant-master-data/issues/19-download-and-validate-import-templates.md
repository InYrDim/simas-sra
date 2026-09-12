# 19 — Download dan validasi template impor

**What to build:** Sediakan template `.xlsx` terpisah untuk Siswa, Guru, dan Staf serta upload yang membuat Batch Impor Orang dan Revisi Impor melalui durable validation job tanpa menulis Master Data.

**Blocked by:** 11 — Kelola Warga Sekolah yang memiliki beberapa profil.

**Status:** resolved

- [x] Template Siswa, Guru, dan Staf dibuat dari validation contract yang sama dengan server.
- [x] Workbook memiliki sheet `Petunjuk`, `Data`, dan protected `Referensi`, machine-readable entity type, serta semantic version.
- [x] Identifier cells memakai text dan instruksi tanggal memakai `YYYY-MM-DD`.
- [x] Download mengikuti School Admin, Tenant lifecycle, dan import-download feature flag.
- [x] Upload maksimal 10 MB dan 5.000 data rows; type tidak ditentukan dari filename.
- [x] Password protection, macro, formula, external link, embedded image, corruption, unsupported version, dan ambiguous structure ditolak.
- [x] Upload menyimpan protected Tenant-scoped file dan membuat batch; validation berjalan sebagai durable job.
- [x] Validation menghasilkan immutable revision dan row findings `Siap`, `Peringatan`, atau `Ditolak` tanpa menulis Warga Sekolah/profile/account.
- [x] Job dapat dilanjutkan setelah restart, tidak diproses ganda oleh dua worker, dan tidak memasukkan cell payload ke generic logs.
- [x] Template, parser, storage contract, authorization, worker claim/retry, MySQL ownership, dan no-Master-Data-write memiliki test.

## Comments

Implemented shared versioned XLSX contracts and generation/parsing for Siswa, Guru, and Staf; import-specific fail-closed feature flags; protected Tenant-scoped upload; durable MySQL batch/job/revision/row persistence with locked claims, retry/backoff, and stale-lease recovery; thin download/upload routes and worker entrypoint. Validation persists only immutable import records. Evidence: targeted tests, real-MySQL import test, typecheck, lint, and full 259-test suite passed on 2026-07-20.
