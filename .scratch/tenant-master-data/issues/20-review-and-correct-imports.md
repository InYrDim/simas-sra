# 20 — Review dan koreksi hasil impor

**What to build:** Buat spreadsheet review agar School Admin dapat memahami validation findings, menyelesaikan kemungkinan duplicate, skip row, dan membuat revision koreksi tanpa mengubah Master Data.

**Blocked by:** 19 — Download dan validasi template impor.

**Status:** ready-for-agent

- [ ] Review menampilkan source row, values yang diperlukan, field findings, dan status Siap/Peringatan/Ditolak.
- [ ] School Admin dapat search row/name/identifier dan filter status atau problematic column.
- [ ] Exact identifier yang menemukan satu Warga Sekolah kompatibel tanpa target profile menjadi explicit strong-link decision.
- [ ] Existing target profile, ambiguous identity, incompatible shared data, atau hard uniqueness conflict ditolak.
- [ ] Similar candidate hanya berasal dari Tenant yang sama dan hanya menampilkan field yang diperlukan untuk keputusan.
- [ ] Setiap warning diselesaikan dengan `link dan tambah profile`, `buat orang baru karena berbeda`, atau `skip`.
- [ ] Shared Warga Sekolah data tidak pernah ditimpa diam-diam dan tidak ada auto-merge.
- [ ] School Admin dapat download correction workbook tanpa data candidate/unrelated Tenant, lalu upload sebagai revision baru.
- [ ] Keputusan lama hanya dibawa ke revision baru ketika identity-relevant data dan target tidak berubah.
- [ ] School Admin lain yang saat ini authorized dapat melanjutkan unexecuted Tenant-owned revision dan setiap keputusan mencatat actor.
- [ ] Responsive review, keyboard access, Tenant isolation, immutable revisions, decision carry-forward, dan no-write behavior memiliki test.
