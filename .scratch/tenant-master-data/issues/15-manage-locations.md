# 15 — Kelola Lokasi dan Ruang

**What to build:** Buat bagian Lokasi/Ruang pada Sarana & Prasarana agar School Admin dapat mengelola hierarchy lokasi tanpa cycle atau hidden cascade.

**Blocked by:** 01 — Lindungi seluruh area Master Data; 02 — Sediakan pola halaman Master Data yang konsisten.

**Status:** ready-for-agent

- [ ] School Admin dapat membuat lokasi dengan nama, code, type, capacity opsional, description opsional, dan parent opsional.
- [ ] Name/code dinormalisasi dan code unik dalam Tenant serta tetap dicadangkan setelah archive.
- [ ] Parent wajib berasal dari Tenant yang sama dan sistem menolak self-parent serta hierarchy cycle.
- [ ] School Admin dapat search, filter, sort, paginate, melihat detail hierarchy, dan edit lokasi.
- [ ] Lokasi dengan active child atau active reference tidak dapat diarsipkan dan semua blocker ditampilkan.
- [ ] Archive tidak mengarsipkan child atau menghapus references secara otomatis.
- [ ] Reactivation menjalankan ulang uniqueness dan parent validation.
- [ ] Tenant isolation, cycle detection, concurrent hierarchy edit, archive blockers, dan responsive UI memiliki test.
