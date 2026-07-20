# 16 — Kelola Aset dan riwayat inventaris

**What to build:** Tambahkan bagian Aset/Barang pada Sarana & Prasarana untuk grouped dan individual assets dengan riwayat quantity, condition, dan location.

**Blocked by:** 15 — Kelola Lokasi dan Ruang.

**Status:** ready-for-agent

- [ ] School Admin dapat membuat grouped atau individually tracked asset dengan inventory code, category, condition, quantity, location opsional, dan acquisition data opsional.
- [ ] Tracking mode menentukan validasi quantity dan tidak dapat diubah dengan cara yang merusak history.
- [ ] Inventory code Tenant-unique dan tetap dicadangkan setelah archive.
- [ ] Quantity tidak pernah negatif, termasuk saat dua perubahan berjalan bersamaan.
- [ ] Perubahan quantity, condition, atau location meminta alasan dan menyimpan before/after, actor, serta time.
- [ ] Current asset state dan history tersimpan atomik; kegagalan tidak membuat keduanya berbeda.
- [ ] Hanya lokasi aktif dari Tenant yang sama dapat dipakai.
- [ ] Archive mempertahankan identity/history dan ditolak saat ada blocker; reactivation memvalidasi ulang.
- [ ] List/detail/search, grouped/individual validation, MySQL concurrency, history, Tenant isolation, dan UI memiliki test.
