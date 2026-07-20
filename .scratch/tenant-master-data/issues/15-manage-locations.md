# 15 — Kelola Lokasi dan Ruang

**What to build:** Buat bagian Lokasi/Ruang pada Sarana & Prasarana agar School Admin dapat mengelola hierarchy lokasi tanpa cycle atau hidden cascade.

**Blocked by:** 01 — Lindungi seluruh area Master Data; 02 — Sediakan pola halaman Master Data yang konsisten.

**Status:** resolved

- [x] School Admin dapat membuat lokasi dengan nama, code, type, capacity opsional, description opsional, dan parent opsional.
- [x] Name/code dinormalisasi dan code unik dalam Tenant serta tetap dicadangkan setelah archive.
- [x] Parent wajib berasal dari Tenant yang sama dan sistem menolak self-parent serta hierarchy cycle.
- [x] School Admin dapat search, filter, sort, paginate, melihat detail hierarchy, dan edit lokasi.
- [x] Lokasi dengan active child atau active reference tidak dapat diarsipkan dan semua blocker ditampilkan.
- [x] Archive tidak mengarsipkan child atau menghapus references secara otomatis.
- [x] Reactivation menjalankan ulang uniqueness dan parent validation.
- [x] Tenant isolation, cycle detection, concurrent hierarchy edit, archive blockers, dan responsive UI memiliki test.

## Answer

Implemented Tenant-isolated Lokasi/Ruang management in the shared responsive Master Data workspace with normalized reserved codes, optional acyclic parent hierarchy, optimistic concurrency, explicit archive/reactivation, and enumerated active child/reference blockers without hidden cascade.

Added an additive MySQL migration with composite Tenant ownership constraints and transactional audit history. Review found and fixed blocker visibility in the detail UI. Validation passed: 234 tests including real-MySQL concurrent hierarchy edits, focused ticket tests, TypeScript typecheck, ESLint, and `git diff --check`.
