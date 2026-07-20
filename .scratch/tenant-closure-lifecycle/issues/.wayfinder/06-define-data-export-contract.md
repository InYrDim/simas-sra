# Tetapkan kontrak ekspor data sebelum penghapusan

Type: grilling
Status: resolved
Blocked by: 01, 02, 05

## Question

Data apa yang termasuk dalam ekspor, siapa yang dapat meminta dan mengunduhnya, bagaimana ekspor disetujui dan diamankan, berapa lama hasilnya tersedia, serta status dan kegagalan apa yang harus memblokir Penghapusan Tenant?

## Answer

### Cakupan

Ekspor menghasilkan Paket Ekspor Tenant sebagai paket portabilitas lengkap atas data yang menjadi hak sekolah, bukan salinan mentah database. Paket mencakup seluruh data operasional sekolah, dokumen dan berkas unggahan, konfigurasi khusus Tenant, daftar pengguna beserta peran dan hubungan mereka dengan Tenant, serta riwayat aktivitas yang layak diketahui sekolah.

Paket tidak mencakup password hash, token, sesi, atau rahasia autentikasi lain; data internal Provider; data Tenant lain; identitas atau hubungan pengguna di luar Tenant; maupun log keamanan dan diagnostik internal. Untuk tindakan Provider yang memengaruhi Tenant, riwayat yang diekspor mencatat jenis tindakan, waktu, alasan yang boleh ditampilkan, dan aktor sebagai Provider tanpa membuka identitas personal petugas atau detail internal.

### Kewenangan dan keamanan

Semua School Admin yang masih aktif pada Tenant dapat meminta ekspor selama Tenant ditutup dan sebelum Penghapusan Tenant dimulai. Permintaan tidak memerlukan persetujuan Provider Admin. Provider Admin dapat meminta ekspor untuk dukungan dengan alasan wajib. Permintaan, akses status, pembuatan tautan, pengunduhan, percobaan ulang, dan pembatalan diaudit sesuai kewenangan masing-masing.

Permintaan dan setiap pengunduhan mewajibkan autentikasi ulang. Tautan unduhan hanya dapat dipakai sekali, berlaku 15 menit, dan terikat kepada pengguna yang menerimanya. Paket dienkripsi saat disimpan dan dikirim. Hanya School Admin yang masih aktif pada Tenant dan Provider Admin yang berwenang dapat melihat status atau mengunduh hasil. Kewajiban pemberitahuan atas permintaan, pengunduhan, kegagalan, dan pembatalan menjadi input bagi tiket Tetapkan kebijakan notifikasi dan audit lifecycle.

### Format, snapshot, dan masa tersedia

Paket berupa arsip terkompresi dan versioned yang berisi CSV UTF-8 untuk data tabular, JSON untuk data bertingkat dan relasional, berkas unggahan dalam format aslinya, `manifest.json`, dan README berbahasa Indonesia. Manifest mencatat versi skema, identitas Tenant, waktu snapshot dan waktu selesai, cakupan, jumlah record dan berkas, serta checksum. Paket tidak menjanjikan dukungan impor kembali otomatis ke SIMAS.

Snapshot ditetapkan ketika permintaan diterima. Perubahan setelah waktu itu tidak masuk diam-diam ke paket. Hanya satu permintaan aktif yang diproses pada satu waktu; permintaan berikutnya diarahkan ke pekerjaan aktif atau dapat memakai kembali hasil dengan snapshot dan versi skema identik. Perubahan data yang termasuk cakupan mengharuskan snapshot baru.

Paket tersedia selama tujuh hari kalender setelah selesai, lalu dihapus otomatis. Selama Penghapusan Tenant belum dimulai, School Admin dapat meminta paket baru. Paket segera dihapus jika Tenant dibuka kembali. Saat Penghapusan Tenant dikonfirmasi, paket yang tersisa dan tautan aktif dibatalkan serta dihapus. Kedaluwarsa paket tidak memperpanjang Masa Tunggu Penghapusan dan tidak menjadi blocker.

### Status, kegagalan, dan blocker

Ekspor bersifat all-or-nothing. Paket hanya berstatus Tersedia setelah seluruh data, berkas, manifest, dan checksum berhasil dibuat dan diverifikasi; paket parsial tidak dapat diunduh sebagai ekspor resmi dan artefak sementaranya dibersihkan.

Status Antrean, Diproses, Mencoba kembali, dan Gagal dan perlu tindakan memblokir konfirmasi akhir Penghapusan Tenant. Kegagalan sementara dicoba ulang otomatis paling banyak tiga kali. Setelah itu, School Admin dapat mencoba ulang atau membatalkan permintaannya dengan autentikasi ulang. Provider Admin dapat mencoba ulang, memperbaiki masalah operasional, atau membatalkan dengan alasan wajib, audit, dan pemberitahuan. Status Tersedia, Kedaluwarsa, Dibatalkan, atau kegagalan permanen yang telah diselesaikan tidak memblokir; paket tidak wajib benar-benar diunduh sebelum penghapusan.

Saat Provider Admin memulai konfirmasi akhir, sistem menutup sementara penerimaan permintaan baru dan memeriksa blocker. Pemeriksaan blocker dan transisi yang menandai Penghapusan Tenant telah dimulai harus atomik. Jika ada blocker, konfirmasi ditolak dan Tenant tetap utuh. Jika tidak ada, autentikasi ulang dan konfirmasi akhir menutup penerimaan ekspor secara permanen sebelum penghapusan berjalan.
