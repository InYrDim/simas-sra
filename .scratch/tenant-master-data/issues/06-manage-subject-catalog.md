# 06 — Kelola katalog Mata Pelajaran

**What to build:** Ubah placeholder Mata Pelajaran menjadi katalog Tenant yang lengkap dengan create, read, edit, archive, reactivation, search, dan pagination.

**Blocked by:** 01 — Lindungi seluruh area Master Data; 02 — Sediakan pola halaman Master Data yang konsisten.

**Status:** ready-for-agent

- [ ] School Admin dapat membuat Mata Pelajaran dengan code, nama, education level yang berlaku, dan deskripsi opsional.
- [ ] Code dan nama dinormalisasi dan unik dalam satu Tenant.
- [ ] Record Tenant lain tidak memengaruhi uniqueness dan tidak dapat dibaca atau diubah.
- [ ] School Admin dapat mencari, memfilter, mengurutkan, membuka detail, dan mengubah Mata Pelajaran.
- [ ] Archive mempertahankan code, identity, history, dan references; hard delete tidak tersedia.
- [ ] Code tetap dicadangkan setelah archive dan reactivation memvalidasi aturan saat ini.
- [ ] Mata Pelajaran tidak menyimpan Guru, Rombel, jadwal, teaching load, atau passing grade.
- [ ] Empty, no-results, loading, error, read-only, conflict, archived, dan mobile states mengikuti workspace bersama.
- [ ] Domain command, MySQL uniqueness/scoping, route adapter, dan critical UI flow memiliki test.
