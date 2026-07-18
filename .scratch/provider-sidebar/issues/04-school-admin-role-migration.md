Type: task
Status: resolved

## Question

Apa seluruh dampak migrasi identifier role Tenant dari `superadmin` menjadi `school-admin`, dan bagaimana urutan migrasinya menjaga tipe, data, konfigurasi menu, serta pemeriksaan otorisasi tetap konsisten?

## Answer

Gunakan `school-admin` sebagai identifier kanonis untuk **School Admin**, yaitu role administratif tertinggi di dalam satu Tenant. Jangan sediakan alias runtime `superadmin`, karena istilah itu ambigu terhadap Provider Admin dan belum ada data produksi dalam repository yang mengharuskan kompatibilitas sementara.

### Inventaris kondisi saat ini

- `types/Role.ts` mendefinisikan `superadmin` hanya sebagai anggota union TypeScript. `Role` juga memuat sentinel `"*"`; pada implementasi nanti sebaiknya bedakan `TenantRole` dari wildcard konfigurasi agar `"*"` tidak dapat menjadi role pengguna.
- `components/dashboard/dashboard-header.tsx` memakai `superadmin` pada role switcher demo dan label “Superadmin”. State ini lokal pada header dan tidak mengubah role yang diteruskan layout ke sidebar, jadi bukan sumber otorisasi.
- `app/(provider)/dashboard/layout.tsx` meneruskan `role="superadmin"` ke sidebar Tenant. Penggunaan ini **dihapus**, bukan diganti menjadi `school-admin`, saat area Provider memperoleh sidebar dan guard Provider sendiri.
- `components/nav-menu/README.md` memakai `superadmin` dalam contoh konfigurasi; contoh dan istilah naratif harus diganti menjadi `school-admin`/“School Admin”.
- `components/nav-menu/config.ts` saat ini tidak memuat `superadmin`: semua menu menggunakan wildcard. Bila pembatasan menu School Admin ditambahkan pada konfigurasi yang sama, gunakan `school-admin`.
- `auth-schema.ts`, `db/schema.ts`, konfigurasi Better Auth, dan file SQL repository tidak memiliki kolom atau nilai role. Karena itu tidak ada migrasi database atau backfill yang perlu dijalankan untuk kondisi repository saat ini.
- Tidak ada guard route/action berbasis `superadmin` pada kode saat ini. Penyembunyian menu tetap bukan batas keamanan; ketika otorisasi Tenant dihubungkan, server harus memperoleh `TenantRole` dari sumber tepercaya dan memeriksanya kembali pada DAL/action/handler.
- Referensi `superadmin` di `.scratch/` historis tidak mengendalikan runtime. Dokumen aktif yang menjadi handoff implementasi harus memakai bahasa kanonis; arsip keputusan lama tidak perlu ditulis ulang bila konteks historisnya harus dipertahankan.

### Urutan migrasi aman

1. **Tetapkan kontrak role Tenant.** Ganti anggota `Role` dari `superadmin` menjadi `school-admin`; idealnya beri nama tipe `TenantRole` dan pisahkan tipe matcher menu `TenantRole | "*"`. Provider Admin tidak masuk union ini.
2. **Perbarui konsumen Tenant secara atomik.** Ganti literal, label, fixture/test, role switcher demo, contoh README, dan entri konfigurasi menu dari `superadmin`/“Superadmin” menjadi `school-admin`/“School Admin”. Type-check pada tahap ini menjadi daftar konsumen yang belum termigrasi.
3. **Pisahkan konsumen Provider.** Jangan membuat `school-admin` sebagai prop palsu agar sidebar Provider lolos tipe. Hapus pemakaian `AppSidebar role="superadmin"` bersamaan dengan pemasangan sidebar Provider khusus; akses Provider berasal dari grant `provider_admin`, bukan role Tenant.
4. **Hubungkan otorisasi Tenant ketika sumber role nyata tersedia.** Tambahkan persistence/backfill hanya bila implementasi terpisah memperkenalkan penyimpanan role. Jika deployment ternyata memiliki data di luar schema repository, lakukan audit nilai lebih dahulu, backfill `superadmin` ke `school-admin` dalam migrasi data yang sama dengan constraint/enum baru, verifikasi tidak ada nilai lama, lalu hapus kompatibilitas penulisan lama.
5. **Validasi batas.** Jalankan pencarian case-insensitive untuk `superadmin`; hasil runtime harus nol. Referensi yang tersisa hanya boleh berupa catatan historis eksplisit. Type-check, lint, dan test harus membuktikan menu School Admin tetap sama, pengguna Tenant non-admin tidak memperoleh menu admin, dan School Admin tidak mendapat akses `/provider/*`.

### Acceptance criteria

- Domain/UI aktif hanya menyebut **School Admin** dan identifier `school-admin` untuk sisi Tenant.
- `TenantRole` tidak memuat Provider Admin maupun wildcard; wildcard hanya tersedia pada tipe matcher konfigurasi navigasi.
- Area Provider tidak mengimpor atau menyuplai role Tenant.
- Tidak ada migrasi database kosong/palsu untuk role yang belum dipersist; jika data eksternal ditemukan sebelum implementasi, handoff berhenti sampai inventaris dan strategi backfill ditambahkan.
- Menu Tenant selain perubahan nama tetap tidak berubah oleh migrasi ini.
- Otorisasi Provider tetap berdasarkan `provider_admin` dan invariant user tanpa Tenant; nilai role Tenant tidak pernah memberi akses Provider.
