# SIMAS

SIMAS adalah aplikasi SaaS pendidikan yang dikelola secara terpusat oleh penyedia layanan dan menyediakan ruang kerja terisolasi bagi setiap sekolah.

## Language

**Provider**:
Organisasi internal yang memiliki dan mengoperasikan layanan SIMAS untuk seluruh sekolah.
_Avoid_: Tenant, sekolah, developer

**Provider Admin**:
Pengguna internal Provider yang mengelola layanan SIMAS dan seluruh Tenant. Untuk saat ini, ini adalah satu-satunya role di sisi Provider.
_Avoid_: Superadmin, School Admin, developer

**School Admin**:
Pengguna dengan kewenangan administratif tertinggi yang terikat pada tepat satu Tenant dan hanya mengelola sekolahnya sendiri.
_Avoid_: Superadmin, Provider Admin, admin Provider

**Tenant**:
Ruang kerja sekolah yang terisolasi di dalam SIMAS, mencakup data, konfigurasi, dan pengguna milik satu sekolah.
_Avoid_: Provider, customer, akun

**Penyediaan Tenant**:
Pembentukan ruang kerja sekolah oleh Provider sebelum sekolah mulai menggunakan SIMAS.
_Avoid_: Onboarding Provider, onboarding Tenant

**Onboarding Tenant**:
Proses yang dilakukan sekolah untuk menginisialisasi SIMAS bagi sekolahnya setelah ruang kerja tersedia.
_Avoid_: Penyediaan Tenant, pendaftaran oleh Provider

**Pemohon**:
Pengguna yang mendaftar melalui jalur publik untuk mewakili satu sekolah serta membuat dan mengelola Pengajuan SIMAS, tetapi belum menjadi School Admin. Pengguna menjadi Pemohon sejak registrasi, meskipun belum mengirim Pengajuan pertamanya.
_Avoid_: Tenant, School Admin, akun

**Pengajuan SIMAS**:
Permohonan sekolah kepada Provider untuk memperoleh Tenant SIMAS. Pengajuan yang ditolak tidak diubah atau dibuka kembali; sekolah mengirim Pengajuan SIMAS baru.
_Avoid_: Tenant, registrasi pengguna, Onboarding Tenant

**Kredensial sementara**:
Rahasia sekali pakai yang diterbitkan Provider untuk login awal School Admin yang akunnya dibuat oleh Provider dan wajib diganti sebelum School Admin dapat menggunakan Tenant. Kredensial ini tidak diterbitkan kepada Pemohon yang dipromosikan menjadi School Admin karena akun tersebut mempertahankan kredensial yang sudah dimilikinya.
_Avoid_: kata sandi permanen, undangan Provider

**Trial Tenant**:
Masa evaluasi penggunaan SIMAS yang dimulai ketika sekolah menyelesaikan Onboarding Tenant, bukan ketika Tenant disediakan atau School Admin login pertama kali.
_Avoid_: masa onboarding, masa sejak persetujuan

**Penutupan Tenant**:
Penghentian operasional Tenant yang dapat dipulihkan tanpa menghapus data milik sekolah.
_Avoid_: Penghapusan Tenant, penonaktifan akun

**Penghapusan Tenant**:
Penghilangan permanen Tenant beserta data milik sekolah, berbeda dari Penutupan Tenant yang dapat dipulihkan.
_Avoid_: Penutupan Tenant, arsip Tenant

**Kasus Penutupan Tenant**:
Riwayat tunggal yang menaungi perjalanan Penutupan Tenant sejak diajukan atau dimulai Provider hingga ditolak, dibatalkan, kedaluwarsa, dibuka kembali, atau dihapus.
_Avoid_: status Tenant, tiket dukungan, Pengajuan SIMAS

**Masa Tunggu Penghapusan**:
Jangka waktu sejak Tenant ditutup sampai Tenant siap menerima konfirmasi akhir Penghapusan Tenant; berakhirnya masa ini tidak otomatis menghapus Tenant.
_Avoid_: masa retensi backup, penghapusan otomatis, masa Penutupan Tenant

**Paket Ekspor Tenant**:
Snapshot portabel atas data yang menjadi hak sekolah untuk dibawa keluar dari SIMAS sebelum Penghapusan Tenant, tanpa rahasia autentikasi, data internal Provider, atau data dari konteks lain.
_Avoid_: salinan database, backup Tenant, arsip Tenant

**Eksekusi Penghapusan Tenant**:
Proses terkoordinasi yang membersihkan dan memverifikasi seluruh lokasi data wajib setelah Penghapusan Tenant dikonfirmasi, serta dapat dilanjutkan secara aman ketika sebagian langkah gagal.
_Avoid_: Penghapusan Tenant selesai, transaksi tunggal, rollback penghapusan

**Catatan Penghapusan Tenant**:
Bukti minimal internal Provider bahwa Penghapusan Tenant telah selesai tanpa mempertahankan data operasional sekolah yang dihapus.
_Avoid_: Tenant terhapus, arsip Tenant, tanda terima sekolah

**Tanda Terima Penghapusan Tenant**:
Bukti eksternal minimum yang dapat dipegang sekolah untuk merujuk dan menanyakan Penghapusan Tenant tanpa memuat data operasional atau menjadi rahasia autentikasi.
_Avoid_: Catatan Penghapusan Tenant, Paket Ekspor Tenant, backup Tenant

**Daftar Penekanan Penghapusan**:
Catatan minimal berpengenal pseudonim yang memastikan data Tenant yang telah dihapus tidak hidup kembali ketika backup lama dipulihkan.
_Avoid_: backup Tenant, arsip Tenant, data sekolah

**Penghapusan Tenant selesai**:
Milestone ketika seluruh penyimpanan aktif terverifikasi bersih sehingga Tenant tidak dapat diakses atau dipulihkan melalui operasi normal, meskipun salinan residual masih dapat menunggu berakhirnya retensi backup.
_Avoid_: Permanen di seluruh penyimpanan, backup telah musnah

**Permanen di seluruh penyimpanan**:
Milestone ketika backup terakhir yang mungkin memuat data Tenant telah musnah melalui rotasi terverifikasi dan tidak ada legal hold yang masih berlaku.
_Avoid_: Penghapusan Tenant selesai, Penutupan Tenant

**Halaman Status Tenant**:
Permukaan terbatas bagi School Admin untuk melihat keadaan Tenant yang ditutup dan menjalankan tindakan lifecycle yang masih diizinkan tanpa mengakses ruang kerja sekolah.
_Avoid_: dashboard Tenant, ruang kerja Tenant
