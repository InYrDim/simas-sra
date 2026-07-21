# 16 — Kelola Aset dan riwayat inventaris

**What to build:** Tambahkan bagian Aset/Barang pada Sarana & Prasarana untuk grouped dan individual assets dengan riwayat quantity, condition, dan location.

**Blocked by:** 15 — Kelola Lokasi dan Ruang.

**Status:** resolved

- [x] School Admin dapat membuat grouped atau individually tracked asset dengan inventory code, category, condition, quantity, location opsional, dan acquisition data opsional.
- [x] Tracking mode menentukan validasi quantity dan tidak dapat diubah dengan cara yang merusak history.
- [x] Inventory code Tenant-unique dan tetap dicadangkan setelah archive.
- [x] Quantity tidak pernah negatif, termasuk saat dua perubahan berjalan bersamaan.
- [x] Perubahan quantity, condition, atau location meminta alasan dan menyimpan before/after, actor, serta time.
- [x] Current asset state dan history tersimpan atomik; kegagalan tidak membuat keduanya berbeda.
- [x] Hanya lokasi aktif dari Tenant yang sama dapat dipakai.
- [x] Archive mempertahankan identity/history dan ditolak saat ada blocker; reactivation memvalidasi ulang.
- [x] List/detail/search, grouped/individual validation, MySQL concurrency, history, Tenant isolation, dan UI memiliki test.

## Answer

Implemented Tenant-isolated grouped and individual Aset/Barang management in the shared responsive Master Data workspace, with reserved inventory codes, active same-Tenant location validation, immutable tracking mode, explicit archive/reactivation blockers, and reasoned inventory changes that atomically persist current state plus before/after history, actor, and time.

Added an additive MySQL migration with composite Tenant ownership constraints, nonnegative/grouped-individual quantity checks, transactional history, and row-locking concurrency. Review found and fixed active assets as Lokasi/Ruang archive blockers. Validation passed: 241 full-suite tests, 12 focused tests including real-MySQL asset and location concurrency, TypeScript typecheck, ESLint, and `git diff --check`.
