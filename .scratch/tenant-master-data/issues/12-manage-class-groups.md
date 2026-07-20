# 12 — Kelola Rombongan Belajar dasar

**What to build:** Ubah placeholder Rombongan Belajar menjadi halaman untuk mengelola class group yang terikat pada satu Tahun Ajaran.

**Blocked by:** 05 — Kelola Tahun Ajaran dan Semester.

**Status:** ready-for-agent

- [ ] School Admin dapat membuat Rombel dengan Tahun Ajaran, education level, grade, group name, code opsional, capacity opsional, dan primary location opsional.
- [ ] Lifecycle mendukung Draft, Aktif, Ditutup, dan Dibatalkan melalui action eksplisit.
- [ ] Tahun Ajaran, education level, dan grade tidak dapat diubah setelah Rombel aktif.
- [ ] Lifecycle tidak berubah otomatis karena tanggal.
- [ ] School Admin dapat search, filter, sort, paginate, membuka detail, dan edit field yang masih diperbolehkan.
- [ ] Hanya terminal Rombel tanpa blocker yang dapat diarsipkan.
- [ ] Reactivation tidak mengaktifkan kembali Rombel atau relationship lama.
- [ ] Archive state dan lifecycle state ditampilkan terpisah.
- [ ] Tenant ownership, uniqueness, concurrency, lifecycle transition, archive, dan responsive UI memiliki test.
