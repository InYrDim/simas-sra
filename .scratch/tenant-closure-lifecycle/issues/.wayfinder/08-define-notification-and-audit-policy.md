# Tetapkan kebijakan notifikasi dan audit lifecycle

Type: grilling
Status: resolved
Blocked by: 01, 02, 03

## Question

Peristiwa lifecycle mana yang harus memberi tahu School Admin dan Provider Admin, melalui kanal apa dan dengan isi minimum apa; serta aktor, alasan, waktu, perubahan jadwal, konfirmasi, dan hasil eksekusi apa yang wajib dicatat untuk audit?

## Answer

### Notifikasi ditunda

Notifikasi proaktif tidak termasuk scope implementasi lifecycle saat ini. Tidak ada email, SMS/WhatsApp, maupun pusat notifikasi yang wajib dibangun. Perubahan lifecycle tersedia bagi seluruh School Admin aktif melalui Halaman Status Tenant dan riwayat kasus, serta bagi Provider Admin melalui konsol lifecycle Tenant.

Ketersediaan informasi pada permukaan tersebut memenuhi kebutuhan transparansi saat ini, tetapi tidak berarti sistem telah mengirim pemberitahuan. Kebijakan notifikasi proaktif harus ditetapkan dalam upaya terpisah sebelum kanal tersebut diperkenalkan. Kegagalan atau ketiadaan notifikasi tidak memengaruhi validitas transisi lifecycle.

### Cakupan audit

Setiap Kasus Penutupan Tenant memiliki riwayat audit append-only. Audit wajib mencatat:

- semua tindakan lifecycle yang berhasil;
- semua transisi otomatis, termasuk kedaluwarsa peninjauan dan tercapainya tenggat;
- perubahan tenggat dan blocker;
- hasil proses ekspor dan Penghapusan Tenant;
- percobaan tindakan sensitif yang ditolak karena autentikasi ulang gagal, kewenangan tidak cukup, status kasus berubah, atau blocker masih aktif.

Entri audit tidak dapat diedit atau dihapus. Koreksi dibuat sebagai entri baru yang merujuk entri sebelumnya.

### Aktor dan waktu

Setiap entri menyimpan snapshot ID pengguna yang stabil, nama tampilan, role saat tindakan dilakukan, jenis aktor (`school_admin`, `provider_admin`, atau `system`), Tenant dan Kasus Penutupan Tenant terkait, waktu server dalam UTC, serta sumber tindakan seperti UI, job terjadwal, atau proses internal.

Aktor `system` juga menyimpan nama proses pemicu, seperti `closure_review_expiry`, `deletion_deadline`, atau `tenant_deletion_worker`, beserta correlation ID eksekusi. Alamat IP, user-agent, dan lokasi bukan atribut audit wajib.

### Isi perubahan dan bukti konfirmasi

Setiap entri audit sekurang-kurangnya menyimpan:

- jenis peristiwa canonical;
- status Tenant dan status kasus sebelum serta sesudah tindakan;
- alasan atau catatan aktor apabila tindakan mensyaratkannya;
- nilai lama dan baru untuk perubahan tenggat, termasuk zona waktu;
- blocker yang menyebabkan tindakan ditolak;
- hasil tindakan: berhasil, ditolak, atau gagal;
- request ID atau correlation ID;
- metode konfirmasi tindakan sensitif, keberhasilan autentikasi ulang, dan waktu verifikasinya.

Audit tidak menyimpan kata sandi, token sesi, kredensial autentikasi ulang, isi konfirmasi mentah, Paket Ekspor Tenant, atau data operasional sekolah. Untuk konfirmasi akhir Penghapusan Tenant, audit hanya menyimpan identifier Tenant yang diharapkan, hasil kecocokan, dan bukti keberhasilan autentikasi ulang.

### Akses

- Selama Tenant masih ada, seluruh School Admin aktif dapat melihat riwayat lifecycle Tenant melalui Halaman Status Tenant.
- School Admin hanya melihat informasi yang relevan bagi sekolah. Detail keamanan internal, correlation ID, alasan teknis, dan aktivitas internal Provider disembunyikan.
- Provider Admin dapat melihat riwayat lengkap, termasuk kegagalan proses dan percobaan tindakan yang ditolak.
- Setelah Penghapusan Tenant berhasil, akses School Admin berakhir karena hubungan dengan Tenant telah dicabut.
- Provider Admin tetap dapat mengakses audit minimal yang melekat pada Catatan Penghapusan Tenant tanpa mempertahankan data operasional sekolah.
- Riwayat audit tidak menyediakan fungsi edit atau hapus melalui UI.

### Retensi

Audit lifecycle dan Catatan Penghapusan Tenant dipertahankan selama lima tahun setelah Penghapusan Tenant berhasil, lalu dihapus otomatis, kecuali terdapat kewajiban hukum yang menahan penghapusan. Rekaman yang dipertahankan dibatasi pada identitas Tenant, aktor, waktu, keputusan, alasan, perubahan tenggat, bukti konfirmasi, dan hasil eksekusi.

Retensi audit ini terpisah dari kebijakan retensi backup dan tidak menentukan kapan salinan pada backup dihapus.

### Atomisitas dan kegagalan

Perubahan lifecycle dan auditnya harus atomik. Jika audit tidak dapat dicatat, tindakan manual atau transisi domain tidak boleh dianggap berhasil. Kegagalan audit pada job otomatis menggagalkan eksekusi dan dapat dicoba ulang secara idempotent.

Untuk Penghapusan Tenant, niat dan konfirmasi dicatat sebelum eksekusi, lalu hasil berhasil atau gagal dicatat sesudahnya. Jika data berhasil dihapus tetapi hasil akhir belum tercatat akibat kegagalan parsial, proses rekonsiliasi wajib menyelesaikan Catatan Penghapusan Tenant dan audit tanpa menjalankan ulang penghapusan secara berbahaya.
