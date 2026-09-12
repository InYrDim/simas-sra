# Tetapkan operasi dukungan setelah Penghapusan Tenant

Type: grilling
Status: resolved
Blocked by: 07, 08, 10

## Question

Bukti dan informasi minimum apa yang dapat digunakan Provider untuk menjawab pertanyaan atau sengketa setelah Penghapusan Tenant; siapa yang dapat mengaksesnya, tindakan dukungan apa yang masih tersedia, bagaimana identitas sekolah diverifikasi, dan batas apa yang mencegah dukungan berubah menjadi pemulihan data yang telah dinyatakan dihapus?

## Answer

### Sumber bukti dan batas akses

Setelah Penghapusan Tenant selesai, Provider hanya boleh menangani pertanyaan atau sengketa menggunakan Catatan Penghapusan Tenant, audit lifecycle minimal yang masih diretensi, bukti kontrol backup untuk menentukan milestone Permanen di seluruh penyimpanan, dan catatan administratif nonoperasional yang memiliki dasar retensi sah. Dukungan tidak boleh membuka atau mencari backup, memulihkan Tenant, maupun memperoleh artefak lama dari sistem internal untuk menjawab permintaan biasa.

Provider Admin hanya boleh membuka bukti pascapenghapusan ketika menangani permintaan dukungan, sengketa, audit, atau kewajiban hukum yang tercatat. Tujuan akses dan referensi kasus dukungan wajib dicantumkan, setiap akses diaudit, dan tampilan dibatasi pada informasi minimum yang diperlukan. Kebijakan ini merupakan otorisasi kontekstual bagi Provider Admin, bukan role domain baru.

### Verifikasi pihak sekolah

Karena identitas School Admin dan kontak sekolah telah dihapus, pemohon membawa bukti untuk diverifikasi secara independen: referensi atau Tanda Terima Penghapusan Tenant, bukti kewenangan terkini untuk mewakili sekolah melalui dokumen atau kanal resmi, serta informasi milestone yang cukup untuk menemukan catatan secara aman. Referensi penghapusan bukan rahasia autentikasi dan kepemilikannya saja tidak membuktikan kewenangan.

Jika verifikasi tidak memadai, Provider hanya boleh menjelaskan kebijakan umum tanpa mengonfirmasi apakah Tenant atau Catatan Penghapusan Tenant tertentu pernah ada. Kehilangan tanda terima tidak menghapus hak sekolah untuk meminta dukungan, tetapi menuntut verifikasi independen yang lebih ketat.

### Tindakan dukungan yang tersedia

Setelah verifikasi berhasil, Provider boleh:

- mengonfirmasi apakah Penghapusan Tenant selesai beserta waktu mulai dan selesai;
- menjelaskan versi kebijakan penghapusan yang diterapkan;
- menyampaikan ringkasan hasil verifikasi per kategori penyimpanan;
- menyampaikan batas maksimum retensi backup dan apakah milestone Permanen di seluruh penyimpanan telah tercapai;
- menjelaskan adanya legal hold atau insiden yang menunda permanensi tanpa membuka detail keamanan sensitif;
- menerbitkan kembali bukti atau pernyataan yang bersumber dari Catatan Penghapusan Tenant; dan
- menerima serta menyelidiki dugaan ketidakpatuhan proses penghapusan.

Provider wajib membedakan kedua milestone dalam komunikasinya. Pada Penghapusan Tenant selesai, Provider hanya menyatakan bahwa penyimpanan aktif telah bersih dan data tidak dapat diakses atau dipulihkan melalui operasi normal. Provider baru boleh menyatakan Permanen di seluruh penyimpanan setelah rotasi backup terverifikasi dan tidak ada legal hold. Klaim absolut yang melampaui bukti kontrol dilarang.

Dukungan tidak boleh mengubah bukti asli, memberikan data operasional yang telah dihapus, membuat Tenant pengganti sebagai bentuk pemulihan, atau menyalin maupun menyerahkan data yang ditemukan dalam penyelidikan kepada sekolah.

### Koreksi dan remediasi

Kesalahan administratif diperbaiki melalui entri append-only yang merujuk bukti sebelumnya; bukti asli tidak diubah atau dihapus. Koreksi mencatat alasan, Provider Admin, waktu, dan dasar perubahan, serta hanya memperbaiki fakta proses tanpa menambahkan kembali identitas atau data sekolah.

Indikasi bahwa lokasi data belum bersih diperlakukan sebagai insiden penghapusan. Remediasi hanya boleh membersihkan data yang semestinya sudah dihapus dan wajib diaudit; proses ini tidak boleh berubah menjadi pemulihan, penyalinan, atau penyerahan data.

### Kasus dukungan pascapenghapusan

Permintaan dukungan menjadi kasus administratif baru yang terpisah dari Tenant dan Kasus Penutupan Tenant. Kasus ini hanya menyimpan identitas pemohon, bukti kewenangan minimum, tujuan permintaan, keputusan, dan korespondensi yang diperlukan. Dokumen verifikasi mentah dihapus setelah verifikasi dan masa sengketa operasional berakhir. Ringkasan keputusan dan audit akses mengikuti kebijakan retensi dukungan atau kewajiban hukum yang berlaku, tetapi tidak boleh melebihi lima tahun tanpa dasar hukum khusus.

Data kasus dukungan tidak boleh dimasukkan kembali ke Catatan Penghapusan Tenant atau shell Kasus Penutupan Tenant, digunakan untuk membuat profil baru sekolah, maupun dipakai untuk merekonstruksi Tenant.

### Bukti eksternal bagi sekolah

Tanda Terima Penghapusan Tenant adalah bukti eksternal milik sekolah, terpisah dari Catatan Penghapusan Tenant internal Provider. Sebelum konfirmasi akhir, Halaman Status Tenant menjelaskan bahwa akses akan berakhir dan menyarankan sekolah menyimpan referensi kasus. Saat penghapusan selesai, SIMAS menghasilkan tanda terima yang dapat diberikan oleh Provider atau diunduh selama permukaan status masih tersedia tanpa mewajibkan notifikasi proaktif.

Tanda terima memuat referensi acak yang tidak mudah ditebak, milestone penghapusan, versi kebijakan, dan cara menghubungi Provider. Tanda terima tidak memuat data operasional, daftar pengguna, atau rahasia autentikasi.
