# 07 — Kelola identitas Warga Sekolah dan Siswa

**What to build:** Ubah placeholder Siswa menjadi halaman end-to-end untuk membuat Warga Sekolah dan Profil Siswa tanpa membuat Akun Pengguna.

**Blocked by:** 01 — Lindungi seluruh area Master Data; 02 — Sediakan pola halaman Master Data yang konsisten.

**Status:** ready-for-agent

- [ ] School Admin dapat membuat Warga Sekolah dengan field pribadi wajib/opsional sesuai spec dan Profil Siswa dengan NIS, entry date, serta status Aktif.
- [ ] NIK 16 digit, NIP 18 digit, NIS, dan NISN 10 digit disimpan sebagai text dan unik dalam Tenant ketika diisi.
- [ ] Whitespace, empty optional values, email, phone, dan identifier dinormalisasi sama di command dan persistence.
- [ ] Exact identifier milik record tidak kompatibel atau Profil Siswa yang sudah ada ditolak.
- [ ] Exact identifier milik Warga Sekolah kompatibel tanpa Profil Siswa dapat dipilih secara eksplisit untuk menambah profil.
- [ ] Similar name/birth/place/contact menghasilkan warning dan tidak pernah auto-merge.
- [ ] Membuat Siswa tidak membuat, menghubungkan, atau memberi role kepada Akun Pengguna.
- [ ] List/detail menampilkan nama, NIS, NISN, status, Rombel jika ada, account-link status, dan archive state.
- [ ] Search nama/identifier, pagination, create/edit, concurrency, audit, Tenant isolation, dan mobile flow memiliki test.
