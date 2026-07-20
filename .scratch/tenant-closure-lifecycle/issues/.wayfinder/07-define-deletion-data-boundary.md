# Tetapkan batas data Penghapusan Tenant

Type: grilling
Status: resolved
Blocked by: 01, 06

## Question

Entitas dan hubungan data mana yang dihapus, dipertahankan, dianonimkan, atau dilepaskan ketika Tenant dihapus; bagaimana identitas bersama, audit, pengajuan historis, file, dan referensi lintas batas ditangani; serta bukti apa yang menandai penghapusan selesai?

## Answer

### Prinsip kepemilikan

Penghapusan Tenant menghapus seluruh data yang keberadaannya bergantung pada Tenant. Ini mencakup data operasional sekolah, konfigurasi, dokumen, berkas, aktivitas, serta seluruh hubungan dan hak akses pengguna pada Tenant. Tidak boleh tersisa akun yatim, tombstone, atau referensi aktif yang dapat digunakan untuk mengakses atau merekonstruksi ruang kerja sekolah.

Semua identitas pengguna yang dibuat untuk dan hanya hidup dalam Tenant—termasuk School Admin, guru, staf, siswa, dan role Tenant lainnya—dihapus bersama profil, kredensial, MFA, sesi, token, preferensi, dan relasinya. Satu School Admin hanya terikat pada satu Tenant. Identitas domain lain yang benar-benar independen, seperti Provider Admin atau Pemohon dengan Pengajuan SIMAS lain, tetap dipertahankan; kecocokan email atau nomor telepon saja tidak membuktikan bahwa dua identitas adalah sama.

### Pengajuan dan riwayat

Pengajuan SIMAS yang menghasilkan Tenant direduksi menjadi catatan Provider minimal dan anonim. Isi pengajuan, dokumen, kontak, identitas Pemohon, dan data sekolah dihapus. Catatan yang tersisa hanya boleh memuat referensi non-operasional, milestone waktu, dan hasil keputusan yang diperlukan untuk membuktikan proses Provider.

Riwayat aktivitas operasional Tenant dihapus. Audit lifecycle Provider dapat dipertahankan secara minimal dengan pengenal pseudonim, jenis dan waktu tindakan, jenis aktor, hasil, kategori alasan, serta referensi otorisasi tanpa rahasia. Audit tersebut tidak menyimpan nama sekolah, identitas personal, alasan bebas, payload perubahan, atau snapshot data Tenant.

Kasus Penutupan Tenant dipertahankan sebagai shell historis immutable berstatus `deleted`, berisi hanya ID pseudonim, milestone waktu, jenis alur, keputusan lifecycle, dan referensi ke Catatan Penghapusan Tenant. Alasan bebas, komentar, identitas aktor, detail autentikasi dan ekspor, nama sekolah, serta identifier Tenant asli dihapus.

### Berkas dan referensi lintas batas

Penghapusan mencakup berkas asli, thumbnail, preview, hasil konversi, indeks pencarian, analytics yang dapat ditelusuri ke Tenant, cache, data sementara, Paket Ekspor Tenant beserta artefak sementaranya, dan pesan antrean. Pekerjaan asinkron harus dibatalkan atau dinetralkan agar tidak menciptakan kembali data setelah penghapusan.

Referensi yang hanya mendukung operasi Tenant dihapus. Catatan dengan dasar retensi independen diputus dari row Tenant, dibersihkan dari payload, lampiran, nama sekolah, kontak, dan data operasional, lalu hanya boleh memakai referensi pseudonim yang tidak memungkinkan rekonstruksi. Statistik agregat boleh dipertahankan hanya jika tidak memungkinkan identifikasi ulang. Foreign key menggantung dan tombstone yang masih memuat data sekolah dilarang. Kegagalan membersihkan salah satu lokasi wajib membuat Penghapusan Tenant gagal, bukan sekadar menghasilkan peringatan.

Backup tidak termasuk verifikasi lokasi aktif ini dan memerlukan kebijakan retensi serta pemulihan tersendiri sebelum arti permanen dinyatakan lengkap.

### Bukti penyelesaian

Catatan Penghapusan Tenant adalah bukti minimal dan immutable bahwa pembersihan selesai. Catatan ini memuat ID catatan, referensi pseudonim ke Kasus Penutupan Tenant, waktu mulai dan selesai, jenis pemicu, jenis aktor tanpa identitas personal, versi kebijakan penghapusan, hasil verifikasi per kategori lokasi data, hasil akhir, dan referensi audit keamanan terbatas.

Catatan tidak menyimpan nama sekolah, domain, alamat, kontak, ID Tenant asli, daftar pengguna, metrik operasional sekolah, nama berkas, isi data, maupun hash langsung dari identifier yang mudah ditebak. Catatan hanya diterbitkan dan kasus hanya menjadi `deleted` setelah database aktif, object storage, indeks, cache, ekspor, antrean, serta lokasi aktif wajib lainnya terverifikasi bersih.
