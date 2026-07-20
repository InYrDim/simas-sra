# 11 — Kelola Warga Sekolah yang memiliki beberapa profil

**What to build:** Lengkapi perilaku aggregate Warga Sekolah ketika satu orang memiliki lebih dari satu Profil Siswa, Guru, atau Staf.

**Blocked by:** 08 — Kelola lifecycle dan archive Siswa; 09 — Kelola Profil Guru; 10 — Kelola Profil Staf dan riwayat jabatan.

**Status:** resolved

- [x] Satu Warga Sekolah dapat memiliki maksimal satu profil dari setiap jenis dan beberapa jenis profil sekaligus.
- [x] Edit shared personal data dari satu profile terlihat dari semua profile orang yang sama.
- [x] UI memberi tahu profil lain yang akan terpengaruh sebelum menyimpan shared data.
- [x] NIP correction berlaku ke semua konteks dan menyimpan before/after audit.
- [x] Akun Pengguna tetap maksimal satu, opsional, dan Tenant yang sama; Master Data tidak mengubah link tersebut.
- [x] Warga Sekolah tidak otomatis archived ketika profile diarsipkan.
- [x] Action archive Warga Sekolah hanya berhasil setelah semua profile archived.
- [x] Reactivation profile dapat mengaktifkan Warga Sekolah setelah uniqueness check, tetapi tidak profile/relationship lain.
- [x] Identifier Warga Sekolah tetap dicadangkan setelah archive.
- [x] Multi-profile creation, duplicate prevention, shared edits, archive/reactivation, and cross-Tenant tests pass.

## Answer

Implemented the Tenant-scoped Warga Sekolah aggregate across Profil Siswa, Guru, and Staf. Shared edits now disclose every affected sibling profile, profile lifecycles remain independent, aggregate archive is blocked until all profiles are archived, and profile reactivation reactivates only the person plus the selected profile without restoring other profiles or relationships. Account links remain read-only and unchanged; identifiers remain reserved.

Added aggregate archive audit persistence with affected profile kinds, actor, Tenant, and optimistic versions. Existing profile edit/reactivation audits retain NIP before/after and person-version changes for the shared Warga Sekolah. Validation passed with 209 tests (including real-MySQL suites), focused multi-profile/cross-Tenant tests, typecheck, lint, and diagnostics.
