# 12 — Kelola Rombongan Belajar dasar

**What to build:** Ubah placeholder Rombongan Belajar menjadi halaman untuk mengelola class group yang terikat pada satu Tahun Ajaran.

**Blocked by:** 05 — Kelola Tahun Ajaran dan Semester.

**Status:** resolved

- [x] School Admin dapat membuat Rombel dengan Tahun Ajaran, education level, grade, group name, code opsional, capacity opsional, dan primary location opsional.
- [x] Lifecycle mendukung Draft, Aktif, Ditutup, dan Dibatalkan melalui action eksplisit.
- [x] Tahun Ajaran, education level, dan grade tidak dapat diubah setelah Rombel aktif.
- [x] Lifecycle tidak berubah otomatis karena tanggal.
- [x] School Admin dapat search, filter, sort, paginate, membuka detail, dan edit field yang masih diperbolehkan.
- [x] Hanya terminal Rombel tanpa blocker yang dapat diarsipkan.
- [x] Reactivation tidak mengaktifkan kembali Rombel atau relationship lama.
- [x] Archive state dan lifecycle state ditampilkan terpisah.
- [x] Tenant ownership, uniqueness, concurrency, lifecycle transition, archive, dan responsive UI memiliki test.

## Answer

Implemented Tenant-isolated Rombongan Belajar management in the shared responsive Master Data workspace. Rombel now binds to one Tahun Ajaran, supports validated academic context and optional active Tenant location references, explicit forward-only lifecycle actions, optimistic concurrency, terminal-only archive blockers, and safe terminal-state reactivation without restoring relationships.

Added an additive MySQL schema and real-MySQL coverage for Tenant ownership, reserved uniqueness, and concurrent stale writes. Review completed and the closed-year edit/location-reactivation edge cases were tightened. Validation passed: all 216 tests, real MySQL adapter tests, TypeScript typecheck, ESLint, and `git diff --check`. The repository-wide migrator remains blocked by the pre-existing `simas_application.owner_user_id` foreign-key alteration; this ticket's additive migration was applied and tested independently.
