# 13 — Kelola anggota Rombel dan Wali Kelas

**What to build:** Tambahkan effective-dated membership Siswa dan assignment Wali Kelas ke Rombongan Belajar dengan transfer atomik dan history yang tidak ditimpa.

**Blocked by:** 08 — Kelola lifecycle dan archive Siswa; 09 — Kelola Profil Guru; 12 — Kelola Rombongan Belajar dasar.

**Status:** ready-for-agent

- [ ] School Admin dapat menambah Siswa aktif ke Rombel yang valid.
- [ ] Satu Siswa maksimal memiliki satu membership aktif pada satu waktu.
- [ ] Satu planned membership diperbolehkan untuk Tahun Ajaran Draft tanpa menutup current membership.
- [ ] Transfer menutup membership lama dan membuka membership baru pada effective date yang sama dalam satu transaksi.
- [ ] Promotion tidak terjadi otomatis.
- [ ] School Admin dapat menetapkan atau mengganti Guru aktif sebagai Wali Kelas.
- [ ] Satu Rombel maksimal memiliki satu Wali Kelas aktif dan satu Guru maksimal satu Rombel dalam Tahun Ajaran yang sama.
- [ ] Wali Kelas tidak membuat subject-teaching assignment.
- [ ] Membership dan assignment histories tampil di detail dan menjadi archive blockers yang sesuai.
- [ ] MySQL concurrency tests membuktikan tidak ada double membership atau double Wali Kelas.
