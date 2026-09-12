# 05 — Kelola Tahun Ajaran dan Semester

**What to build:** Buat halaman Tahun Ajaran agar School Admin dapat membuat periodenya sendiri dan menjalankan lifecycle secara eksplisit tanpa perubahan otomatis berdasarkan kalender.

**Blocked by:** 01 — Lindungi seluruh area Master Data; 02 — Sediakan pola halaman Master Data yang konsisten.

**Status:** resolved

- [x] School Admin dapat membuat Tahun Ajaran dengan label Tenant-unique, tanggal mulai/selesai, Semester Ganjil, dan Semester Genap.
- [x] Kedua semester wajib berada di dalam Tahun Ajaran, berurutan, sambung, dan tidak tumpang tindih.
- [x] Lifecycle yang diizinkan adalah `Draft → Aktif → Ditutup` dan `Draft → Dibatalkan`.
- [x] Maksimal satu Tahun Ajaran dan satu Semester aktif dalam satu Tenant, dibuktikan dengan real-MySQL concurrency test.
- [x] Tanggal kalender tidak mengubah status secara otomatis.
- [x] Hanya Tahun Ajaran Ditutup atau Dibatalkan yang dapat diarsipkan.
- [x] Reactivation mengembalikan terminal state sebelumnya dan tidak membuatnya aktif.
- [x] List/detail membedakan lifecycle state dari archive state.
- [x] Semua transition menyimpan actor, waktu, effective date, dan audit/history.

## Answer

Implemented Tenant-isolated Tahun Ajaran management in the shared Master Data workspace with explicit creation, semester validation, forward-only lifecycle actions, separate archive state, and transactional history. Added additive MySQL tables and generated active-slot uniqueness constraints for one active Tahun Ajaran and Semester per Tenant.

TDD and review completed. Validation passed: TypeScript typecheck, ESLint, `git diff --check`, and all 140 tests including the real-MySQL concurrency test. The repository-wide `db:migrate` command remains blocked by an older migration that alters `simas_application.owner_user_id` while its foreign key exists; this ticket's additive migration was applied independently for MySQL validation.
