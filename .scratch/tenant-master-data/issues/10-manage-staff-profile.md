# 10 — Kelola Profil Staf dan riwayat jabatan

**What to build:** Ubah placeholder Staf menjadi halaman lengkap yang menambah Profil Staf ke Warga Sekolah dan mempertahankan history lifecycle serta jabatan.

**Blocked by:** 07 — Kelola identitas Warga Sekolah dan Siswa.

**Status:** ready-for-agent

- [ ] School Admin dapat membuat Warga Sekolah baru dengan Profil Staf atau menambah Profil Staf ke Warga Sekolah kompatibel.
- [ ] Internal Staf number wajib dan Tenant-unique; NIP tetap milik Warga Sekolah.
- [ ] Jabatan, employment type, service start, status, unit kerja opsional, dan catatan opsional divalidasi.
- [ ] Nilai jabatan dan employment type memakai stable choices; `Lainnya` meminta keterangan.
- [ ] Mengubah jabatan menutup assignment lama dan membuat assignment baru tanpa menimpa history.
- [ ] Lifecycle Aktif, Cuti, dan Berakhir mengikuti effective-date dan reason rules Guru.
- [ ] Archive hanya setelah Berakhir dan tanpa blocker aktif; active account hanya warning.
- [ ] List/detail/search menampilkan identifier, NIP, jabatan aktif, employment type, status, account-link, dan archive.
- [ ] Membuat atau mengubah Staf tidak membuat atau mengubah Akun Pengguna.
- [ ] Duplicate, Tenant isolation, position history, lifecycle overlap, archive, concurrency, dan UI memiliki test.
