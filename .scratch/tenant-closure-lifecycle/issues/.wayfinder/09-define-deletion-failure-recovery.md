# Tetapkan pemulihan kegagalan Penghapusan Tenant

Type: grilling
Status: resolved
Blocked by: 01, 07

## Question

Bagaimana eksekusi Penghapusan Tenant menjaga atomicity dan idempotency di database, file, serta integrasi eksternal; bagaimana progres dan percobaan direkam; dan tindakan pemulihan atau retry apa yang tersedia ketika sebagian langkah berhasil tetapi keseluruhan penghapusan gagal?

## Answer

### Kontrak keberhasilan

Penghapusan Tenant menggunakan atomicity bisnis melalui Eksekusi Penghapusan Tenant bertahap yang durable, idempotent, dan dapat dilanjutkan. Sistem tidak menjanjikan satu transaksi ACID lintas database, object storage, indeks, cache, antrean, dan integrasi eksternal. Tenant memasuki `deletion_in_progress` segera setelah konfirmasi akhir diterima dan sejak itu tidak dapat digunakan, dibuka kembali, atau dibatalkan.

Keberhasilan bersifat all-or-nothing pada tingkat domain: Penghapusan Tenant belum selesai sampai seluruh lokasi wajib terverifikasi bersih. Kegagalan sebagian tidak memulihkan data yang sudah dihapus. Eksekusi menjadi `deletion_failed`, tetap terkunci, dan dilanjutkan dari langkah yang belum terverifikasi. Kasus Penutupan Tenant hanya menjadi `deleted` dan Catatan Penghapusan Tenant hanya diterbitkan setelah seluruh verifikasi berhasil.

### Checkpoint dan idempotency

Setiap lokasi atau kategori data wajib memiliki checkpoint durable berstatus `pending`, `in_progress`, `verification_pending`, `verified_clean`, atau `failed`. Setiap percobaan direkam append-only dengan waktu mulai dan selesai, nomor percobaan, hasil, kategori kesalahan tersanitasi, serta correlation atau idempotency key tanpa menyimpan data Tenant yang sedang dihapus.

Hasil perintah yang tidak pasti tidak dianggap berhasil. Sistem terlebih dahulu memeriksa keadaan tujuan; lokasi yang sudah bersih ditandai `verified_clean`, lokasi yang belum bersih menerima perintah idempotent lagi, dan lokasi yang tidak dapat diverifikasi membuat eksekusi tetap gagal. Retry melewati checkpoint yang sudah terverifikasi dan hanya mengulang langkah gagal atau yang hasilnya belum pasti.

### Pencegahan penciptaan ulang data

Eksekusi mengaktifkan deletion fence durable sebelum pembersihan. Semua jalur tulis, termasuk request, worker, antrean, webhook, impor, ekspor, dan integrasi, wajib menolak atau menetralkan pekerjaan bagi Tenant tersebut. Pekerjaan tertunda dibatalkan bila memungkinkan dan menjadi no-op tercatat jika tetap berjalan. Identifier Tenant lama tidak boleh digunakan kembali.

Fence dipertahankan setelah penghapusan dengan referensi pseudonim minimal yang tidak memuat identitas atau data operasional sekolah. Data yang muncul kembali merupakan kegagalan, harus dibersihkan, dan memerlukan verifikasi ulang sebelum finalisasi.

### Koordinasi dan finalisasi

Hanya satu Eksekusi Penghapusan Tenant boleh aktif bagi satu Kasus Penutupan Tenant. Worker menggunakan lease terbatas waktu dan versi eksekusi; worker pengganti dapat melanjutkan setelah lease kedaluwarsa, sedangkan hasil worker lama tidak boleh menimpa progres terbaru.

Finalisasi berlangsung dalam satu transaksi database dengan penguncian atau compare-and-swap. Transaksi memverifikasi bahwa fence aktif, tidak ada langkah yang berjalan, dan semua lokasi wajib `verified_clean`; kemudian secara atomik menetapkan eksekusi `succeeded`, mengubah kasus menjadi `deleted`, dan menerbitkan tepat satu Catatan Penghapusan Tenant. Perubahan prasyarat atau finalisasi bersamaan menggagalkan transaksi tanpa hasil parsial.

### Retry dan pemulihan

Sistem melakukan retry otomatis dengan exponential backoff untuk kegagalan sementara. Batas jumlah percobaan dan rentang waktunya merupakan konfigurasi operasional, bukan aturan domain. Kegagalan permanen atau habisnya retry membuat eksekusi `deletion_failed`.

Setelah penyebab diperbaiki, Provider Admin dapat menjalankan **Lanjutkan Penghapusan** dengan autentikasi ulang. Tindakan ini membuat percobaan baru pada eksekusi yang sama, bukan konfirmasi penghapusan baru. Tim operasi boleh memperbaiki konfigurasi, konektivitas, kredensial layanan, atau membersihkan lokasi melalui alat internal, tetapi verifier sistem tetap harus membuktikan lokasi bersih.

Provider Admin dan tim operasi tidak boleh melewati langkah wajib, mengubah checkpoint menjadi `verified_clean`, atau menandai penghapusan selesai secara manual. Perubahan daftar lokasi wajib hanya boleh melalui versi kebijakan baru dan perubahan terkontrol, bukan pengecualian retroaktif untuk menyamarkan kegagalan satu Tenant. Seluruh retry dan intervensi diaudit.

### Kegagalan berkepanjangan

`deletion_failed` tidak kedaluwarsa otomatis. Tenant tetap terkunci sampai penghapusan berhasil, sementara sistem mempertahankan hanya metadata minimum untuk melanjutkan dan mengaudit eksekusi. Data yang sudah terhapus tidak dipulihkan dan eksekusi tidak dapat diubah menjadi `cancelled` atau hasil sukses semu.

Jika lokasi wajib tidak lagi dapat diakses atau dependensi eksternal dihentikan permanen, diperlukan migrasi terkontrol atau verifier pengganti melalui perubahan kebijakan. Selama lokasi belum dapat diverifikasi, Catatan Penghapusan Tenant tidak diterbitkan. Notifikasi proaktif atas kegagalan tetap ditunda sesuai kebijakan notifikasi lifecycle.
