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

**Master Data**:
Data identitas dan referensi operasional milik satu Tenant yang dikelola School Admin dan digunakan kembali oleh fitur sekolah lainnya.
_Avoid_: data Provider, Pengaturan Sistem, data transaksi

**Profil Sekolah**:
Satu profil per Tenant yang memuat atribut operasional sekolah yang dikelola School Admin, termasuk Nama Tampilan Sekolah, logo, alamat, dan kontak, serta menampilkan identitas resmi yang dikelola Provider tanpa menduplikasinya.
_Avoid_: identitas Tenant, Pengajuan SIMAS, data Provider

**Nama Resmi Sekolah**:
Nama legal atau administratif sekolah yang menjadi bagian dari identitas resmi Tenant, dikelola Provider, dan hanya dapat dibaca dari ruang kerja Tenant.
_Avoid_: Nama Tampilan Sekolah, nama Tenant yang bebas diedit

**Nama Tampilan Sekolah**:
Nama operasional sekolah yang dikelola School Admin dan digunakan pada antarmuka Tenant tanpa mengubah Nama Resmi Sekolah.
_Avoid_: Nama Resmi Sekolah, NPSN

**Warga Sekolah**:
Identitas seseorang di dalam satu Tenant yang dapat memiliki satu atau lebih profil Siswa, Guru, atau Staf dan secara opsional ditautkan ke satu Akun Pengguna.
_Avoid_: Akun Pengguna, role Tenant, profil peran

**Profil Siswa**:
Peran seorang Warga Sekolah sebagai peserta didik, dengan identitas sekolah dan lifecycle akademiknya sendiri.
_Avoid_: Warga Sekolah, Akun Pengguna, keanggotaan Rombongan Belajar

**Profil Guru**:
Peran seorang Warga Sekolah sebagai tenaga pengajar, terpisah dari Akun Pengguna dan penugasan mengajar periodik.
_Avoid_: role autentikasi Guru, Profil Staf, penugasan mata pelajaran

**Profil Staf**:
Peran seorang Warga Sekolah sebagai tenaga nonpengajar, dengan riwayat jabatan dan penugasan kepegawaiannya sendiri.
_Avoid_: role autentikasi Staf, Profil Guru, Akun Pengguna

**Akun Pengguna**:
Identitas autentikasi yang dapat ditautkan secara opsional ke satu Warga Sekolah dalam Tenant yang sama; kewenangannya berasal dari role akun, bukan profil orang.
_Avoid_: Warga Sekolah, Profil Siswa, Profil Guru, Profil Staf

**Arsip Master Data**:
Keadaan nonaktif suatu catatan Master Data yang mempertahankan identitas dan riwayatnya agar referensi dari fitur sekolah lain tetap utuh.
_Avoid_: hapus permanen, Penghapusan Tenant

**Batch Impor Orang**:
Satu pekerjaan impor Siswa, Guru, atau Staf milik satu Tenant yang menaungi berkas sumber, revisi validasi, keputusan pencocokan identitas, eksekusi, dan hasil per baris.
_Avoid_: satu transaksi untuk seluruh berkas, unggahan sementara tanpa riwayat, impor lintas Tenant

**Revisi Impor**:
Hasil validasi yang tidak berubah untuk satu berkas sumber dalam Batch Impor Orang; mengunggah berkas koreksi membuat revisi baru tanpa menimpa hasil atau keputusan revisi sebelumnya.
_Avoid_: edit langsung data preview, retry eksekusi, versi template

**Tahun Ajaran**:
Periode akademik milik satu Tenant yang menaungi Semester, Rombongan Belajar, dan riwayat keanggotaan Siswa tanpa menimpa periode sebelumnya. Peralihannya dilakukan secara eksplisit dan maju-saja, bukan otomatis mengikuti tanggal kalender.
_Avoid_: tahun kalender, Rombongan Belajar, jadwal

**Semester**:
Bagian wajib dari Tahun Ajaran yang berupa Ganjil atau Genap, memiliki rentang tanggal dan status sendiri, serta tidak dikelola terpisah dari Tahun Ajaran.
_Avoid_: Tahun Ajaran, semester kalender otomatis, periode bebas

**Mata Pelajaran**:
Katalog referensi stabil milik satu Tenant yang mendefinisikan kode, nama, dan jenjang berlakunya suatu bidang pelajaran tanpa menetapkan Guru, Rombongan Belajar, beban mengajar, atau jadwal.
_Avoid_: penugasan mengajar, jadwal pelajaran, mata pelajaran per semester

**Rombongan Belajar**:
Kelompok belajar Siswa pada tingkat dan Tahun Ajaran tertentu yang dapat memiliki Wali Kelas dan Lokasi utama, serta mempertahankan riwayat keanggotaan ketika Siswa berpindah.
_Avoid_: ruang kelas fisik, Mata Pelajaran, jadwal

**Keanggotaan Rombongan Belajar**:
Hubungan efektif-dated antara Siswa dan Rombongan Belajar yang dapat direncanakan sebelum aktif, tidak boleh tumpang tindih dengan keanggotaan aktif lain, dan ditutup alih-alih dihapus.
_Avoid_: profil Siswa, kenaikan kelas otomatis, daftar anggota tanpa riwayat

**Wali Kelas**:
Penugasan efektif-dated seorang Guru untuk membina satu Rombongan Belajar tanpa menyiratkan penugasan mengajar Mata Pelajaran.
_Avoid_: Guru pengampu, role akun, penjadwalan

**Organisasi Siswa**:
Kelompok siswa formal dengan struktur kepengurusan dan periode jabatan, seperti OSIS.
_Avoid_: struktur organisasi sekolah, Ekstrakurikuler

**Ekstrakurikuler**:
Identitas kegiatan pilihan siswa yang stabil lintas Tahun Ajaran, seperti Pramuka atau Futsal, dan dilaksanakan melalui satu atau beberapa Kelompok Kegiatan.
_Avoid_: mata pelajaran, Organisasi Siswa, pelaksanaan tahunan

**Lokasi/Ruang**:
Tempat fisik milik sekolah yang dapat tersusun secara hierarkis dan menjadi lokasi bagi aset atau kegiatan.
_Avoid_: Aset/Barang, alamat Tenant, reservasi ruang

**Aset/Barang**:
Inventaris sekolah yang dicatat secara kelompok atau individual serta mempertahankan riwayat jumlah, kondisi, dan lokasinya.
_Avoid_: Lokasi/Ruang, peminjaman aset, transaksi akuntansi

**Periode Kepengurusan**:
Rentang jabatan pengurus dalam satu Organisasi Siswa yang mempertahankan struktur kepengurusan tanpa menimpa periode sebelumnya.
_Avoid_: Tahun Ajaran, Keanggotaan Organisasi, Organisasi Siswa

**Keanggotaan Organisasi**:
Riwayat keterlibatan seorang Siswa sebagai anggota Organisasi Siswa, terpisah dari jabatan kepengurusannya.
_Avoid_: jabatan pengurus, Keikutsertaan Ekstrakurikuler, role Tenant

oke**Kelompok Kegiatan**:
Pelaksanaan suatu Ekstrakurikuler dalam satu Tahun Ajaran yang menaungi pembina, peserta, lokasi, jadwal, dan kapasitasnya.
_Avoid_: Ekstrakurikuler, Rombongan Belajar, Organisasi Siswa

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
