# 17 — Kelola Organisasi Siswa

**What to build:** Buat bagian Organisasi Siswa untuk stable organization identity, Periode Kepengurusan, general membership, dan leadership history.

**Blocked by:** 08 — Kelola lifecycle dan archive Siswa; 15 — Kelola Lokasi dan Ruang.

**Status:** resolved

- [x] School Admin dapat membuat organisasi dengan nama, singkatan opsional, code, description, founding date, dan secretariat location opsional.
- [x] Code Tenant-unique dan tetap dicadangkan setelah archive.
- [x] School Admin dapat membuat Periode Kepengurusan planned, active, dan completed dengan valid dates.
- [x] Siswa aktif dapat ditambah sebagai member dengan effective dates.
- [x] Hanya member aktif yang dapat menerima leadership assignment.
- [x] Jabatan memakai nama text dan menyatakan apakah beberapa holder bersamaan diperbolehkan.
- [x] Ending leadership tidak otomatis ending membership.
- [x] Future-dated planning hanya diperbolehkan dalam period yang belum aktif; terminal correction memakai action khusus dan audit.
- [x] Archive menampilkan period/membership/leadership/location blockers dan tidak melakukan hidden cascade.
- [x] Tenant isolation, overlap, membership prerequisite, multiplicity, history, archive, dan UI memiliki test.

## Answer

Implemented Tenant-isolated Organisasi Siswa management with stable reserved codes, optional secretariat locations, explicit Periode Kepengurusan lifecycle, effective-dated membership and leadership histories, membership prerequisites, position multiplicity, audited terminal correction, and explicit archive blockers without hidden cascades. The shared responsive workspace exposes URL-backed list/detail state and dedicated relationship/lifecycle actions.

TDD covers isolation, overlap, membership prerequisites, multiplicity, independent relationship endings, terminal history correction, archive behavior, query state, and shared UX. Review fixes ensure leadership remains covered by membership for its full effective range and completed periods remain preserved history rather than permanent archive blockers. Validation passed: 248 full tests, focused real-MySQL schema/constraint validation with no skips, TypeScript typecheck, ESLint, and `git diff --check`.
