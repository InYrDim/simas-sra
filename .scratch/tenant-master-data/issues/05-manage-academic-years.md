# 05 — Kelola Tahun Ajaran dan Semester

**What to build:** Buat halaman Tahun Ajaran agar School Admin dapat membuat periodenya sendiri dan menjalankan lifecycle secara eksplisit tanpa perubahan otomatis berdasarkan kalender.

**Blocked by:** 01 — Lindungi seluruh area Master Data; 02 — Sediakan pola halaman Master Data yang konsisten.

**Status:** ready-for-agent

- [ ] School Admin dapat membuat Tahun Ajaran dengan label Tenant-unique, tanggal mulai/selesai, Semester Ganjil, dan Semester Genap.
- [ ] Kedua semester wajib berada di dalam Tahun Ajaran, berurutan, sambung, dan tidak tumpang tindih.
- [ ] Lifecycle yang diizinkan adalah `Draft → Aktif → Ditutup` dan `Draft → Dibatalkan`.
- [ ] Maksimal satu Tahun Ajaran dan satu Semester aktif dalam satu Tenant, dibuktikan dengan real-MySQL concurrency test.
- [ ] Tanggal kalender tidak mengubah status secara otomatis.
- [ ] Hanya Tahun Ajaran Ditutup atau Dibatalkan yang dapat diarsipkan.
- [ ] Reactivation mengembalikan terminal state sebelumnya dan tidak membuatnya aktif.
- [ ] List/detail membedakan lifecycle state dari archive state.
- [ ] Semua transition menyimpan actor, waktu, effective date, dan audit/history.
