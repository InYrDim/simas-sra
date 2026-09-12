# 04 — Kelola logo dan riwayat akreditasi sekolah

**What to build:** Tambahkan pengelolaan logo sekolah dan riwayat akreditasi ke Profil Sekolah melalui storage interface yang aman dan Tenant-scoped.

**Blocked by:** 03 — Kelola data dasar Profil Sekolah.

**Status:** resolved

- [x] School Admin dapat upload atau mengganti logo JPEG, PNG, atau WebP dengan batas ukuran yang ditentukan kontrak.
- [x] Server memeriksa isi file, bukan hanya extension atau MIME dari browser.
- [x] File disimpan melalui storage interface dengan key/ownership Tenant dan tidak dapat dibaca Tenant lain.
- [x] Kegagalan upload atau database tidak meninggalkan file/database setengah selesai; cleanup dapat dicoba ulang dengan aman.
- [x] School Admin dapat menambah, melihat, dan mengoreksi riwayat akreditasi tanpa menimpa entry lama.
- [x] Accreditation period yang tumpang tindih atau tidak valid ditolak.
- [x] File akreditasi, jika didukung, memakai authorization dan storage policy yang sama.
- [x] Fitur file tidak dapat diaktifkan sebelum retention policy dikonfigurasi.
- [x] Storage contract, authorization, failure cleanup, dan MySQL transaction memiliki test.

## Answer

Profil Sekolah kini mendukung upload/penggantian logo PNG, JPEG, dan WebP melalui protected storage yang Tenant-scoped. Server memeriksa signature dan dimensi isi file, membatasi sumber hingga 2 MB dan minimal 256 × 256 persegi, serta menolak aktivasi bila `PROTECTED_STORAGE_ROOT` atau `SCHOOL_ASSET_RETENTION_DAYS` belum dikonfigurasi. Penyimpanan file, referensi database, version, dan audit dikoordinasikan dengan cleanup idempotent ketika transaksi gagal.

Riwayat akreditasi kini dapat ditambah, dibaca, dan dikoreksi secara append-preserving. Periode invalid atau tumpang tindih ditolak; koreksi menginvalidasi entry lama dengan alasan dan menambahkan pengganti tanpa hard delete. Certificate asset akreditasi belum didukung pada ticket ini, sehingga tidak ada jalur file kedua yang dapat melewati policy logo. Migrasi `20260720070310_add-school-logo-accreditation` bersifat additive dan memakai composite Tenant ownership constraints.
