# 07 — Kelola identitas Warga Sekolah dan Siswa

**What to build:** Ubah placeholder Siswa menjadi halaman end-to-end untuk membuat Warga Sekolah dan Profil Siswa tanpa membuat Akun Pengguna.

**Blocked by:** 01 — Lindungi seluruh area Master Data; 02 — Sediakan pola halaman Master Data yang konsisten.

**Status:** resolved

- [x] School Admin dapat membuat Warga Sekolah dengan field pribadi wajib/opsional sesuai spec dan Profil Siswa dengan NIS, entry date, serta status Aktif.
- [x] NIK 16 digit, NIP 18 digit, NIS, dan NISN 10 digit disimpan sebagai text dan unik dalam Tenant ketika diisi.
- [x] Whitespace, empty optional values, email, phone, dan identifier dinormalisasi sama di command dan persistence.
- [x] Exact identifier milik record tidak kompatibel atau Profil Siswa yang sudah ada ditolak.
- [x] Exact identifier milik Warga Sekolah kompatibel tanpa Profil Siswa dapat dipilih secara eksplisit untuk menambah profil.
- [x] Similar name/birth/place/contact menghasilkan warning dan tidak pernah auto-merge.
- [x] Membuat Siswa tidak membuat, menghubungkan, atau memberi role kepada Akun Pengguna.
- [x] List/detail menampilkan nama, NIS, NISN, status, Rombel jika ada, account-link status, dan archive state.
- [x] Search nama/identifier, pagination, create/edit, concurrency, audit, Tenant isolation, dan mobile flow memiliki test.

## Answer

Implemented Tenant-isolated Warga Sekolah and Profil Siswa management with normalized textual identifiers, explicit compatible-person attachment, similarity warnings without auto-merge, optimistic edits, atomic audit records, URL-backed list/query behavior, and the shared responsive Master Data workspace. Account creation, linking, and role assignment remain outside this flow.

TDD and two-axis review completed; the missing explicit existing-person selection found during spec review was added. Validation passed with the full unit/UI/route suite and required real-MySQL Tenant ownership, uniqueness, composite relationship, transaction rollback, audit, and concurrency coverage. The ticket-specific additive migration was applied independently because the repository-wide migration runner is blocked by unrelated historical `simas_application.owner_user_id` migration drift.
