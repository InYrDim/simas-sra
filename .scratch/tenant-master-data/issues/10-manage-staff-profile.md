# 10 — Kelola Profil Staf dan riwayat jabatan

**What to build:** Ubah placeholder Staf menjadi halaman lengkap yang menambah Profil Staf ke Warga Sekolah dan mempertahankan history lifecycle serta jabatan.

**Blocked by:** 07 — Kelola identitas Warga Sekolah dan Siswa.

**Status:** resolved

- [x] School Admin dapat membuat Warga Sekolah baru dengan Profil Staf atau menambah Profil Staf ke Warga Sekolah kompatibel.
- [x] Internal Staf number wajib dan Tenant-unique; NIP tetap milik Warga Sekolah.
- [x] Jabatan, employment type, service start, status, unit kerja opsional, dan catatan opsional divalidasi.
- [x] Nilai jabatan dan employment type memakai stable choices; `Lainnya` meminta keterangan.
- [x] Mengubah jabatan menutup assignment lama dan membuat assignment baru tanpa menimpa history.
- [x] Lifecycle Aktif, Cuti, dan Berakhir mengikuti effective-date dan reason rules Guru.
- [x] Archive hanya setelah Berakhir dan tanpa blocker aktif; active account hanya warning.
- [x] List/detail/search menampilkan identifier, NIP, jabatan aktif, employment type, status, account-link, dan archive.
- [x] Membuat atau mengubah Staf tidak membuat atau mengubah Akun Pengguna.
- [x] Duplicate, Tenant isolation, position history, lifecycle overlap, archive, concurrency, dan UI memiliki test.

## Answer

Implemented Tenant-isolated Profil Staf management on shared Warga Sekolah identities, with explicit compatible-person attachment, Tenant-unique internal numbers, stable position/employment choices, required `Lainnya` descriptions, optional work unit and notes, immutable effective-dated position history, Guru-equivalent lifecycle/archive rules, optimistic concurrency, and shared responsive Master Data UX. Profil Staf remains separate from Akun Pengguna; account state is read-only and an active account is only an archive warning.

TDD and two-axis review completed with no remaining standards or ticket-spec findings. Validation passed with the full 206-test suite, focused Staff service/route/query/UI tests, required real-MySQL Tenant ownership/uniqueness/transaction/lifecycle/audit coverage, typecheck, and lint. The additive Staff migration was applied independently because the repository-wide migration runner remains blocked by unrelated historical `simas_application.owner_user_id` migration drift.
