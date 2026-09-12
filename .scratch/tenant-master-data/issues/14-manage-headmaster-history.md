# 14 — Tambahkan Kepala Sekolah ke Profil Sekolah

**What to build:** Tambahkan assignment Kepala Sekolah yang memilih Guru aktif dan mempertahankan effective-dated history pada Profil Sekolah.

**Blocked by:** 03 — Kelola data dasar Profil Sekolah; 09 — Kelola Profil Guru.

**Status:** resolved

- [x] School Admin dapat memilih Guru aktif dari Tenant yang sama sebagai Kepala Sekolah.
- [x] Maksimal satu assignment Kepala Sekolah aktif dalam satu Tenant.
- [x] Pergantian menutup assignment lama dan membuat assignment baru tanpa menghapus history.
- [x] Effective dates wajib valid dan tidak tumpang tindih.
- [x] Guru archived, Berakhir, atau dari Tenant lain tidak dapat dipilih.
- [x] Assignment Kepala Sekolah aktif menjadi blocker archive Guru.
- [x] Profil Sekolah menampilkan Kepala Sekolah saat ini dan riwayat sebelumnya.
- [x] Assignment, replacement, concurrent assignment, cross-Tenant denial, archive blocker, dan audit memiliki test.

## Comments

Implemented effective-dated Kepala Sekolah assignment on Profil Sekolah with Tenant-scoped Guru eligibility, serialized replacement, database-enforced single-current assignment, immutable history, transactional audit, and Guru archive blocking.

Validation: ticket tests including real MySQL concurrency passed; full suite passed (227 tests); lint and typecheck passed. `next build` reached TypeScript processing but exceeded the 180-second validation timeout. The full migration runner is independently blocked by an older migration that alters `simas_application.owner_user_id` while its foreign key exists; the new additive migration was applied directly for MySQL validation.
