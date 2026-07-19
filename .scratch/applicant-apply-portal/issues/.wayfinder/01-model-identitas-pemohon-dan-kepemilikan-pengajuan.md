# Model identitas Pemohon dan kepemilikan Pengajuan SIMAS

Type: grilling
Status: resolved
Blocked by:

## Question

Bagaimana model data membedakan Pemohon, Provider Admin, dan anggota Tenant; menghubungkan setiap Pengajuan SIMAS ke akun Pemohon; serta menegakkan satu akun untuk satu sekolah/NPSN tanpa merusak riwayat pengajuan ulang?

## Answer

`user` adalah identitas autentikasi tunggal. Setiap user hanya boleh berada pada satu jalur identitas pada satu waktu: Provider Admin, Pemohon, atau anggota satu Tenant. Registrasi publik menghasilkan Pemohon; Provider Admin hanya berasal dari proses internal; anggota Tenant selain hasil promosi tidak melewati jalur Pemohon.

Akun Pemohon belum terikat sekolah saat registrasi. Saat Pengajuan SIMAS pertama dikirim, akun memperoleh ikatan permanen dan unik ke NPSN tersebut. Ikatan berlaku dua arah: satu akun hanya boleh mewakili satu NPSN dan satu NPSN hanya boleh dimiliki satu akun. Penolakan tidak melepaskan ikatan; sengketa atau pergantian Pemohon ditangani manual oleh Provider.

Setiap Pengajuan SIMAS wajib memiliki pemilik `user` yang immutable. Data sekolah dan kontak di dalam Pengajuan adalah snapshot immutable per pengiriman dan boleh berbeda dari identitas akun; relasi pemilik, bukan email kontak, menentukan hak akses dan akun yang akan dipromosikan. Pengajuan baru hanya boleh dibuat jika belum pernah ada Pengajuan atau Pengajuan terakhir ditolak. Hanya satu Pengajuan boleh aktif untuk akun/NPSN, dan approval menutup pengajuan berikutnya.

Approval mempromosikan `user` Pemohon yang sama menjadi School Admin pada Tenant dengan NPSN yang sama. Promosi tidak membuat akun baru dan tidak menerbitkan Kredensial sementara: password, identitas autentikasi, dan relasi kepemilikan riwayat Pengajuan tetap dipertahankan. Setelah promosi, user bukan lagi Pemohon dan tidak dapat mengirim Pengajuan, tetapi seluruh Pengajuan sebelumnya tetap menunjuk kepadanya sebagai pemilik.

Constraint database dan transaksi rinci untuk menegakkan eksklusivitas, keunikan NPSN, satu Pengajuan aktif, dan keamanan konkurensi diputuskan dalam [Tetapkan invarian duplikasi dan konkurensi pengajuan](07-tetapkan-invarian-duplikasi-dan-konkurensi.md). Transisi approval serta dampaknya pada model aktivasi lama diputuskan dalam [Rancang transaksi approval dan penyediaan Tenant](04-rancang-transaksi-approval-dan-penyediaan-tenant.md) dan [Putuskan migrasi aktivasi School Admin](06-putuskan-migrasi-aktivasi-school-admin.md).
