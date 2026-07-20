# Tetapkan retensi backup dan arti permanen

Type: grilling
Status: resolved
Blocked by: 07

## Question

Berapa lama data Tenant yang telah dihapus boleh tetap berada dalam backup, bagaimana data tersebut dilindungi dan dikecualikan dari pemakaian normal, apa yang harus terjadi jika backup dipulihkan, serta kapan Penghapusan Tenant dapat disebut permanen di luar seluruh penyimpanan aktif?

## Answer

### Retensi dan isolasi backup

Backup boleh dipertahankan paling lama 90 hari sejak dibuat. Penyalinan, rotasi, migrasi media, atau perubahan lokasi tidak boleh mengatur ulang maupun memperpanjang masa retensi. Media immutable atau WORM harus memakai batas yang sama; seluruh backup yang mungkin memuat data Tenant wajib musnah melalui rotasi paling lambat 90 hari setelah pembuatannya.

Backup dienkripsi saat disimpan dan ditransmisikan, diisolasi dari sistem operasional, serta hanya dapat diakses oleh personel atau infrastruktur pemulihan yang berwenang dengan autentikasi kuat dan audit akses. Backup tidak boleh dipasang, dicari, atau digunakan untuk analytics, dukungan pelanggan, debugging rutin, pengembangan, pengujian, ekspor, permintaan data biasa, maupun pemulihan satu Tenant yang telah dihapus. Backup juga tidak boleh disalin ke lingkungan dengan perlindungan atau retensi yang lebih lemah.

Penggunaan hanya diperbolehkan untuk pemulihan bencana layanan secara keseluruhan atau kewajiban hukum yang eksplisit. Legal hold menangguhkan pemusnahan hanya sejauh diwajibkan, mempertahankan seluruh pembatasan penggunaan, dan harus dicatat serta ditinjau sampai kewajiban berakhir.

### Pemulihan backup

SIMAS mempertahankan Daftar Penekanan Penghapusan di luar siklus backup operasional. Daftar minimal ini memakai pengenal pseudonim dan informasi yang cukup untuk mencegah Tenant terhapus hidup kembali tanpa menyimpan data sekolah.

Lingkungan hasil pemulihan tetap terisolasi dan tidak boleh menerima trafik pengguna sampai seluruh penghapusan yang terjadi setelah titik backup diterapkan ulang. Proses ini membersihkan kembali data Tenant, pekerjaan asinkron, sesi, token, berkas, indeks, dan referensi terkait, lalu menjalankan ulang verifikasi batas data. Kegagalan apa pun memblokir aktivasi lingkungan dan memicu penanganan insiden. Pemulihan dan penghapusan ulang diaudit, tetapi tidak membuat Kasus Penutupan Tenant baru.

### Arti permanen

Permanensi memiliki dua milestone yang berbeda:

1. **Penghapusan Tenant selesai** ketika seluruh penyimpanan aktif telah dibersihkan dan diverifikasi. Tenant tidak lagi dapat diakses atau dipulihkan melalui operasi normal, meskipun salinan residual mungkin masih berada dalam backup terisolasi.
2. **Permanen di seluruh penyimpanan** ketika backup terakhir yang mungkin memuat data Tenant telah melewati retensinya dan musnah melalui rotasi terverifikasi, serta tidak ada legal hold yang masih berlaku.

SIMAS tidak boleh menyatakan seluruh salinan telah dihapus permanen pada milestone pertama. Catatan Penghapusan Tenant mencatat waktu penyelesaian aktif dan batas waktu maksimum pemusnahan backup secara terpisah tanpa menyimpan identifier Tenant asli atau data sekolah.

### Verifikasi pemusnahan

Permanensi backup dibuktikan melalui kontrol siklus backup, bukan dengan membuka dan mencari data Tenant dalam setiap backup. Inventaris mencatat waktu pembuatan, batas kedaluwarsa, lokasi, dan status pemusnahan setiap generasi. Backup terakhir yang mungkin memuat data Tenant ditentukan dari waktu Penghapusan Tenant selesai, sedangkan rotasi kedaluwarsa diverifikasi melalui kontrol infrastruktur atau bukti penyedia penyimpanan.

SIMAS tidak wajib memodifikasi backup individual untuk menghapus satu Tenant selama isolasi, Daftar Penekanan Penghapusan, dan batas retensi dipenuhi. Kegagalan rotasi, media yang hilang dari inventaris, atau pemusnahan yang tidak dapat dibuktikan menunda milestone Permanen di seluruh penyimpanan dan memicu penanganan insiden.
