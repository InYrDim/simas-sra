# 09 — Kelola Profil Guru

**What to build:** Ubah placeholder Guru menjadi halaman lengkap yang menambah Profil Guru ke Warga Sekolah baru atau existing serta mengelola lifecycle dan archive Guru.

**Blocked by:** 07 — Kelola identitas Warga Sekolah dan Siswa.

**Status:** ready-for-agent

- [ ] School Admin dapat membuat Warga Sekolah baru dengan Profil Guru atau menambah Profil Guru ke Warga Sekolah kompatibel.
- [ ] Internal Guru number wajib dan Tenant-unique; NUPTK opsional, 16 digit, text, dan Tenant-unique.
- [ ] Employment type, service start, dan status assignment divalidasi menggunakan stable codes.
- [ ] Lifecycle mendukung Aktif, Cuti, dan Berakhir dengan effective dates dan required reasons.
- [ ] Returning dari Berakhir ke Aktif membuat service period baru dan tidak membuka assignment lama.
- [ ] Guru hanya dapat diarsipkan setelah Berakhir dan semua blocker aktif selesai; active account hanya warning.
- [ ] Reactivation tidak memulihkan assignment atau status lama secara otomatis.
- [ ] List/detail/search menampilkan identifier, employment type, status, account-link, archive, dan history.
- [ ] Membuat atau mengubah Guru tidak membuat atau mengubah Akun Pengguna.
- [ ] Duplicate, Tenant isolation, transition overlap, archive blocker, concurrency, audit, dan responsive UI memiliki test.
