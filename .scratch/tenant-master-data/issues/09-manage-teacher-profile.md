# 09 — Kelola Profil Guru

**What to build:** Ubah placeholder Guru menjadi halaman lengkap yang menambah Profil Guru ke Warga Sekolah baru atau existing serta mengelola lifecycle dan archive Guru.

**Blocked by:** 07 — Kelola identitas Warga Sekolah dan Siswa.

**Status:** resolved

- [x] School Admin dapat membuat Warga Sekolah baru dengan Profil Guru atau menambah Profil Guru ke Warga Sekolah kompatibel.
- [x] Internal Guru number wajib dan Tenant-unique; NUPTK opsional, 16 digit, text, dan Tenant-unique.
- [x] Employment type, service start, dan status assignment divalidasi menggunakan stable codes.
- [x] Lifecycle mendukung Aktif, Cuti, dan Berakhir dengan effective dates dan required reasons.
- [x] Returning dari Berakhir ke Aktif membuat service period baru dan tidak membuka assignment lama.
- [x] Guru hanya dapat diarsipkan setelah Berakhir dan semua blocker aktif selesai; active account hanya warning.
- [x] Reactivation tidak memulihkan assignment atau status lama secara otomatis.
- [x] List/detail/search menampilkan identifier, employment type, status, account-link, archive, dan history.
- [x] Membuat atau mengubah Guru tidak membuat atau mengubah Akun Pengguna.
- [x] Duplicate, Tenant isolation, transition overlap, archive blocker, concurrency, audit, dan responsive UI memiliki test.

## Answer

Implemented Tenant-isolated Profil Guru management on the shared Warga Sekolah identity, including explicit compatible-person attachment, Tenant-unique textual identifiers, stable employment/status codes, effective-dated service history, audited lifecycle/archive/reactivation, URL-backed responsive list/detail/search, and optimistic concurrency. Profil Guru remains separate from Akun Pengguna; account state is read-only and an active account is only an archive warning.

TDD and two-axis review completed with no remaining standards or ticket-spec findings. Validation passed with the full 187-test suite, required real-MySQL ownership/uniqueness/transaction/lifecycle/audit coverage, typecheck, and lint. The additive teacher migration was applied independently because the repository-wide migration runner remains blocked by unrelated historical `simas_application.owner_user_id` migration drift.
