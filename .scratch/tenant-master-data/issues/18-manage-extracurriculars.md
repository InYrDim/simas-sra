# 18 — Kelola Ekstrakurikuler dan Kelompok Kegiatan

**What to build:** Buat bagian Ekstrakurikuler untuk stable activity identity dan Kelompok Kegiatan per Tahun Ajaran dengan pembina, peserta, lokasi, serta capacity.

**Blocked by:** 05 — Kelola Tahun Ajaran dan Semester; 08 — Kelola lifecycle dan archive Siswa; 09 — Kelola Profil Guru; 10 — Kelola Profil Staf dan riwayat jabatan; 15 — Kelola Lokasi dan Ruang.

**Status:** resolved

- [x] School Admin dapat membuat Ekstrakurikuler dengan nama, code, description opsional, dan default location opsional.
- [x] Code Tenant-unique dan tetap dicadangkan setelah archive.
- [x] School Admin dapat membuat Kelompok Kegiatan untuk satu Tahun Ajaran dengan name, dates, capacity, location, schedule text, dan lifecycle.
- [x] Hanya Guru/Staf aktif Tenant yang sama dapat menjadi pembina.
- [x] Hanya Siswa aktif Tenant yang sama dapat menjadi peserta.
- [x] Capacity menjadi hard limit yang aman terhadap concurrent enrollment.
- [x] Advisor dan participant relationships memakai effective dates dan mempertahankan history.
- [x] Future planning hanya diperbolehkan dalam containing period yang belum aktif.
- [x] Archive menampilkan blockers dan tidak otomatis mengakhiri group, advisor, participant, atau location reference.
- [x] MySQL concurrency, Tenant isolation, lifecycle/history, capacity, archive, list/detail, dan mobile UI memiliki test.

## Answer

Implemented Tenant-isolated Ekstrakurikuler management with stable reserved codes, optional default locations, year-contained Kelompok Kegiatan lifecycle, effective-dated Guru/Staf advisor and Siswa participant histories, explicit archive blockers, and responsive shared list/detail UX. Capacity is serialized transactionally in MySQL so concurrent enrollment cannot exceed the declared hard limit.

TDD covers stable identity, Tenant isolation, Tahun Ajaran containment, future-planning rules, active profile eligibility, relationship history, capacity, archive behavior, URL-backed queries, and mobile/shared UX. A real-MySQL test ran two concurrent enrollments for one remaining seat and proved exactly one commit with one `capacity-reached` result and one persisted participant. Review found no standards or specification findings. Validation passed: 255 full tests with zero skips, focused real-MySQL concurrency, TypeScript typecheck, ESLint, production build, and `git diff --check`.
