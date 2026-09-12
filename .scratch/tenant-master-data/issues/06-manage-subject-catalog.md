# 06 — Kelola katalog Mata Pelajaran

**What to build:** Ubah placeholder Mata Pelajaran menjadi katalog Tenant yang lengkap dengan create, read, edit, archive, reactivation, search, dan pagination.

**Blocked by:** 01 — Lindungi seluruh area Master Data; 02 — Sediakan pola halaman Master Data yang konsisten.

**Status:** resolved

- [x] School Admin dapat membuat Mata Pelajaran dengan code, nama, education level yang berlaku, dan deskripsi opsional.
- [x] Code dan nama dinormalisasi dan unik dalam satu Tenant.
- [x] Record Tenant lain tidak memengaruhi uniqueness dan tidak dapat dibaca atau diubah.
- [x] School Admin dapat mencari, memfilter, mengurutkan, membuka detail, dan mengubah Mata Pelajaran.
- [x] Archive mempertahankan code, identity, history, dan references; hard delete tidak tersedia.
- [x] Code tetap dicadangkan setelah archive dan reactivation memvalidasi aturan saat ini.
- [x] Mata Pelajaran tidak menyimpan Guru, Rombel, jadwal, teaching load, atau passing grade.
- [x] Empty, no-results, loading, error, read-only, conflict, archived, dan mobile states mengikuti workspace bersama.
- [x] Domain command, MySQL uniqueness/scoping, route adapter, dan critical UI flow memiliki test.

## Answer

Implemented the Tenant-isolated Mata Pelajaran catalog with normalized reserved code/name uniqueness, education-level applicability, optional descriptions, optimistic edits, non-destructive archive/reactivation, transactional audit history, URL-backed search/filter/sort/pagination, and shared responsive Master Data states. Added an additive Drizzle migration plus domain, query, route-adapter, UI, and real-MySQL coverage.

TDD and two-axis review completed; the duplicate empty-state review finding was fixed. Validation passed: TypeScript typecheck, ESLint, `git diff --check`, all 151 tests, and the required real-MySQL Tenant isolation/uniqueness/ownership/audit/optimistic-concurrency test. Ticket 06's additive migration was applied independently to avoid relying on unrelated migration history.
