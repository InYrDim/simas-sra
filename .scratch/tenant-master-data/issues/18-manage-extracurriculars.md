# 18 — Kelola Ekstrakurikuler dan Kelompok Kegiatan

**What to build:** Buat bagian Ekstrakurikuler untuk stable activity identity dan Kelompok Kegiatan per Tahun Ajaran dengan pembina, peserta, lokasi, serta capacity.

**Blocked by:** 05 — Kelola Tahun Ajaran dan Semester; 08 — Kelola lifecycle dan archive Siswa; 09 — Kelola Profil Guru; 10 — Kelola Profil Staf dan riwayat jabatan; 15 — Kelola Lokasi dan Ruang.

**Status:** ready-for-agent

- [ ] School Admin dapat membuat Ekstrakurikuler dengan nama, code, description opsional, dan default location opsional.
- [ ] Code Tenant-unique dan tetap dicadangkan setelah archive.
- [ ] School Admin dapat membuat Kelompok Kegiatan untuk satu Tahun Ajaran dengan name, dates, capacity, location, schedule text, dan lifecycle.
- [ ] Hanya Guru/Staf aktif Tenant yang sama dapat menjadi pembina.
- [ ] Hanya Siswa aktif Tenant yang sama dapat menjadi peserta.
- [ ] Capacity menjadi hard limit yang aman terhadap concurrent enrollment.
- [ ] Advisor dan participant relationships memakai effective dates dan mempertahankan history.
- [ ] Future planning hanya diperbolehkan dalam containing period yang belum aktif.
- [ ] Archive menampilkan blockers dan tidak otomatis mengakhiri group, advisor, participant, atau location reference.
- [ ] MySQL concurrency, Tenant isolation, lifecycle/history, capacity, archive, list/detail, dan mobile UI memiliki test.
