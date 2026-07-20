# 14 — Tambahkan Kepala Sekolah ke Profil Sekolah

**What to build:** Tambahkan assignment Kepala Sekolah yang memilih Guru aktif dan mempertahankan effective-dated history pada Profil Sekolah.

**Blocked by:** 03 — Kelola data dasar Profil Sekolah; 09 — Kelola Profil Guru.

**Status:** ready-for-agent

- [ ] School Admin dapat memilih Guru aktif dari Tenant yang sama sebagai Kepala Sekolah.
- [ ] Maksimal satu assignment Kepala Sekolah aktif dalam satu Tenant.
- [ ] Pergantian menutup assignment lama dan membuat assignment baru tanpa menghapus history.
- [ ] Effective dates wajib valid dan tidak tumpang tindih.
- [ ] Guru archived, Berakhir, atau dari Tenant lain tidak dapat dipilih.
- [ ] Assignment Kepala Sekolah aktif menjadi blocker archive Guru.
- [ ] Profil Sekolah menampilkan Kepala Sekolah saat ini dan riwayat sebelumnya.
- [ ] Assignment, replacement, concurrent assignment, cross-Tenant denial, archive blocker, dan audit memiliki test.
