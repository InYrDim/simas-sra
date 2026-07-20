# 17 — Kelola Organisasi Siswa

**What to build:** Buat bagian Organisasi Siswa untuk stable organization identity, Periode Kepengurusan, general membership, dan leadership history.

**Blocked by:** 08 — Kelola lifecycle dan archive Siswa; 15 — Kelola Lokasi dan Ruang.

**Status:** ready-for-agent

- [ ] School Admin dapat membuat organisasi dengan nama, singkatan opsional, code, description, founding date, dan secretariat location opsional.
- [ ] Code Tenant-unique dan tetap dicadangkan setelah archive.
- [ ] School Admin dapat membuat Periode Kepengurusan planned, active, dan completed dengan valid dates.
- [ ] Siswa aktif dapat ditambah sebagai member dengan effective dates.
- [ ] Hanya member aktif yang dapat menerima leadership assignment.
- [ ] Jabatan memakai nama text dan menyatakan apakah beberapa holder bersamaan diperbolehkan.
- [ ] Ending leadership tidak otomatis ending membership.
- [ ] Future-dated planning hanya diperbolehkan dalam period yang belum aktif; terminal correction memakai action khusus dan audit.
- [ ] Archive menampilkan period/membership/leadership/location blockers dan tidak melakukan hidden cascade.
- [ ] Tenant isolation, overlap, membership prerequisite, multiplicity, history, archive, dan UI memiliki test.
