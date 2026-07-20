# 04 — Kelola logo dan riwayat akreditasi sekolah

**What to build:** Tambahkan pengelolaan logo sekolah dan riwayat akreditasi ke Profil Sekolah melalui storage interface yang aman dan Tenant-scoped.

**Blocked by:** 03 — Kelola data dasar Profil Sekolah.

**Status:** ready-for-agent

- [ ] School Admin dapat upload atau mengganti logo JPEG, PNG, atau WebP dengan batas ukuran yang ditentukan kontrak.
- [ ] Server memeriksa isi file, bukan hanya extension atau MIME dari browser.
- [ ] File disimpan melalui storage interface dengan key/ownership Tenant dan tidak dapat dibaca Tenant lain.
- [ ] Kegagalan upload atau database tidak meninggalkan file/database setengah selesai; cleanup dapat dicoba ulang dengan aman.
- [ ] School Admin dapat menambah, melihat, dan mengoreksi riwayat akreditasi tanpa menimpa entry lama.
- [ ] Accreditation period yang tumpang tindih atau tidak valid ditolak.
- [ ] File akreditasi, jika didukung, memakai authorization dan storage policy yang sama.
- [ ] Fitur file tidak dapat diaktifkan sebelum retention policy dikonfigurasi.
- [ ] Storage contract, authorization, failure cleanup, dan MySQL transaction memiliki test.
