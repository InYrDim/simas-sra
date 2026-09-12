# 20 — Review dan koreksi hasil impor

**What to build:** Buat spreadsheet review agar School Admin dapat memahami validation findings, menyelesaikan kemungkinan duplicate, skip row, dan membuat revision koreksi tanpa mengubah Master Data.

**Blocked by:** 19 — Download dan validasi template impor.

**Status:** resolved

- [x] Review menampilkan source row, values yang diperlukan, field findings, dan status Siap/Peringatan/Ditolak.
- [x] School Admin dapat search row/name/identifier dan filter status atau problematic column.
- [x] Exact identifier yang menemukan satu Warga Sekolah kompatibel tanpa target profile menjadi explicit strong-link decision.
- [x] Existing target profile, ambiguous identity, incompatible shared data, atau hard uniqueness conflict ditolak.
- [x] Similar candidate hanya berasal dari Tenant yang sama dan hanya menampilkan field yang diperlukan untuk keputusan.
- [x] Setiap warning diselesaikan dengan `link dan tambah profile`, `buat orang baru karena berbeda`, atau `skip`.
- [x] Shared Warga Sekolah data tidak pernah ditimpa diam-diam dan tidak ada auto-merge.
- [x] School Admin dapat download correction workbook tanpa data candidate/unrelated Tenant, lalu upload sebagai revision baru.
- [x] Keputusan lama hanya dibawa ke revision baru ketika identity-relevant data dan target tidak berubah.
- [x] School Admin lain yang saat ini authorized dapat melanjutkan unexecuted Tenant-owned revision dan setiap keputusan mencatat actor.
- [x] Responsive review, keyboard access, Tenant isolation, immutable revisions, decision carry-forward, dan no-write behavior memiliki test.

## Comments

Implemented an accessible URL-filtered review workspace with mobile cards and a desktop semantic table; Tenant-local exact/similar identity classification; explicit actor-attributed warning decisions; sanitized correction workbook download; and correction upload as an append-only Revisi Impor with safe decision carry-forward. Review and correction paths write only import metadata and protected files—never Warga Sekolah, profiles, or accounts. Review caught and corrected exact target-profile identifier matching. Evidence on 2026-07-20: targeted review/import tests passed, real-MySQL import isolation/no-write test passed, full 262-test suite passed, TypeScript typecheck passed, ESLint passed, and `git diff --check` passed.
