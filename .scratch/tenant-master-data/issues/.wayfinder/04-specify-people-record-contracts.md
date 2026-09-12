# Specify Siswa, Guru, and Staf record contracts

Type: grilling
Status: resolved
Blocked by: 01, 02

## Question

Which fields, identifiers, statuses, validations, duplicate rules, relationships, list operations, edit operations, and archive/reactivation behaviors define Siswa, Guru, and Staf, including whether and how these records relate to authenticated Tenant users?

## Answer

### Warga Sekolah dan identitas bersama

- Warga Sekolah menyimpan nama lengkap, nama panggilan opsional, tempat dan tanggal lahir, jenis kelamin, NIK opsional, agama opsional, alamat tempat tinggal, nomor telepon opsional, email opsional, dan foto profil opsional.
- Nama lengkap, jenis kelamin, tempat lahir, tanggal lahir, dan alamat tempat tinggal wajib diisi. Kolom lainnya bersifat opsional.
- NIP adalah identifier kepegawaian opsional milik Warga Sekolah, bukan salinan pada profil Guru dan Staf. Perubahan NIP dari salah satu konteks berlaku bagi semua profil orang tersebut.
- Data khusus peran berada pada profil Siswa, Guru, atau Staf. Satu Warga Sekolah dapat memiliki beberapa jenis profil tanpa menggandakan data pribadinya.
- Data orang tua atau wali bukan atribut sederhana Siswa dan tidak termasuk kontrak rilis pertama.

### Profil Siswa

- Profil Siswa mewajibkan NIS, tanggal masuk sekolah, dan status. NISN serta nomor peserta didik dari sistem eksternal bersifat opsional.
- NIS wajib unik dalam satu Tenant. NISN, jika diisi, terdiri dari tepat 10 digit dan wajib unik dalam satu Tenant. Keduanya disimpan sebagai teks agar angka nol di depan tidak hilang.
- Siswa baru berstatus `Aktif`. Status lainnya adalah `Lulus`, `Pindah`, dan `Keluar`.
- Perubahan dari `Aktif` ke status lain mewajibkan tanggal efektif dan alasan atau catatan. Siswa `Pindah` atau `Keluar` dapat diterima kembali sebagai `Aktif`.
- Status `Lulus` bersifat final untuk kegiatan akademik biasa, tetapi dapat dikoreksi melalui tindakan khusus dengan alasan wajib.
- Rombongan Belajar bukan atribut langsung Siswa; keanggotaannya merupakan hubungan periodik yang menyimpan riwayat.

### Profil Guru

- Profil Guru mewajibkan nomor internal Guru, jenis kepegawaian, tanggal mulai bertugas, dan status penugasan.
- NUPTK bersifat opsional, terdiri dari tepat 16 digit ketika diisi, disimpan sebagai teks, dan unik dalam satu Tenant.
- Nomor internal Guru wajib unik dalam satu Tenant.
- Guru baru berstatus `Aktif`. Status lainnya adalah `Cuti` dan `Berakhir`.
- `Cuti` mewajibkan tanggal mulai efektif dan dapat memiliki tanggal selesai yang direncanakan.
- `Berakhir` mewajibkan tanggal efektif dan alasan terstruktur: `Pensiun`, `Mutasi`, `Mengundurkan Diri`, `Kontrak Selesai`, atau `Lainnya`.
- Mata pelajaran dan penugasan mengajar bukan atribut profil Guru; keduanya termasuk hubungan periodik di modul akademik berikutnya.
- Riwayat pendidikan, sertifikasi, dan dokumen kepegawaian tidak termasuk rilis pertama.

### Profil Staf

- Profil Staf mewajibkan nomor internal Staf, jabatan, jenis kepegawaian, tanggal mulai bertugas, dan status penugasan. Unit kerja dan catatan kepegawaian bersifat opsional.
- Nomor internal Staf wajib unik dalam satu Tenant.
- Status dan aturan tanggal efektif Staf sama dengan Guru.
- Satu profil Staf hanya memiliki satu jabatan aktif pada satu waktu. Perubahan jabatan menutup penugasan lama dan membuat riwayat penugasan baru.
- Jabatan menggunakan nilai bawaan `Kepala Tata Usaha`, `Administrasi`, `Bendahara`, `Pustakawan`, `Laboran`, `Teknisi`, `Operator Sekolah`, `Keamanan`, `Kebersihan`, atau `Lainnya`. `Lainnya` mewajibkan nama jabatan. Katalog jabatan yang dapat dikelola Tenant tidak termasuk rilis pertama.

### Nilai terstruktur

- Jenis kepegawaian Guru dan Staf adalah `PNS`, `PPPK`, `Tetap Yayasan`, `Tidak Tetap`, `Honorer`, `Kontrak`, atau `Lainnya`; `Lainnya` mewajibkan keterangan.
- Jenis kelamin adalah `Laki-laki` atau `Perempuan`.
- Agama bersifat opsional dengan pilihan `Islam`, `Kristen`, `Katolik`, `Hindu`, `Buddha`, `Konghucu`, `Kepercayaan terhadap Tuhan YME`, atau `Lainnya`; keterangan boleh ditambahkan untuk `Lainnya`.
- Nilai terstruktur disimpan sebagai kode stabil. Tenant tidak dapat mengubah daftar pilihan tersebut pada rilis pertama.

### Validasi data pribadi

- Nama lengkap berisi 2–150 karakter setelah normalisasi spasi dan boleh memakai huruf Unicode, spasi, apostrof, tanda hubung, titik, dan gelar.
- Tempat lahir berisi 2–100 karakter. Tanggal lahir tidak boleh berada di masa depan. Usia tidak dibatasi secara mutlak; nilai yang tidak lazim hanya menghasilkan peringatan.
- NIK, jika diisi, terdiri dari tepat 16 digit dan unik dalam satu Tenant. NIP, jika diisi, terdiri dari tepat 18 digit dan unik dalam satu Tenant. Keduanya disimpan sebagai teks.
- Alamat direpresentasikan sebagai alamat jalan, desa/kelurahan, kecamatan, kabupaten/kota, provinsi, dan kode pos. Hanya alamat jalan yang wajib pada rilis pertama.
- Nomor telepon dinormalisasi dan dapat berupa nomor Indonesia atau internasional. Email divalidasi formatnya dan dinormalisasi ke huruf kecil untuk pencarian. Keduanya tidak wajib unik.
- Foto menerima JPEG, PNG, atau WebP hingga 5 MB dan divalidasi berdasarkan isi berkas.
- Spasi berlebih dirapikan dan input kosong disimpan sebagai nilai kosong, bukan string kosong. Validasi yang sama berlaku pada formulir manual dan impor.

### Duplikat dan identitas

- NIK, NIP, NIS, NISN, NUPTK, nomor internal Guru, dan nomor internal Staf yang sama dalam lingkup keunikannya adalah duplikat pasti dan ditolak.
- Nama dan tanggal lahir yang sama; nama yang sangat mirip dengan tempat dan tanggal lahir yang sama; atau nomor telepon maupun email yang sama menghasilkan peringatan kemiripan, bukan penggabungan otomatis.
- School Admin meninjau kandidat, lalu memilih Warga Sekolah yang ada untuk ditambahkan profil atau mengonfirmasi bahwa orang baru memang berbeda.
- Nama tidak pernah menjadi identifier. Penggabungan Warga Sekolah yang telanjur duplikat tidak termasuk rilis pertama.
- Identifier tetap dicadangkan setelah arsip; School Admin mengaktifkan kembali catatan lama alih-alih membuat duplikat.

### Hubungan dengan Akun Pengguna

- Warga Sekolah dapat berdiri tanpa Akun Pengguna. Hubungan antara keduanya bersifat opsional, satu-ke-satu, dan hanya dalam Tenant yang sama.
- Halaman orang hanya menampilkan status atau identitas akun yang tertaut.
- Pembuatan akun, undangan, penautan, pelepasan tautan, role, dan penonaktifan akun berada di Manajemen Pengguna, bukan Master Data.
- Membuat profil tidak membuat akun atau memberikan role. Role autentikasi tidak disimpulkan dari profil.
- Mengarsipkan profil tidak menonaktifkan akun. Jika profil terakhir diarsipkan sementara akun masih aktif, sistem memperingatkan School Admin untuk meninjau akses melalui Manajemen Pengguna.

### Daftar dan pencarian

- Ketiga halaman mendukung pencarian nama dan identifier, filter status, filter `Aktif`/`Diarsipkan`/`Semua`, pengurutan, pagination server, detail, edit, arsip, dan aktivasi kembali.
- Daftar Siswa menampilkan nama, NIS, NISN, status, Rombongan Belajar aktif jika ada, status akun, dan status arsip.
- Daftar Guru menampilkan nama, nomor internal, NIP atau NUPTK, jenis kepegawaian, status penugasan, status akun, dan status arsip.
- Daftar Staf menampilkan nama, nomor internal, NIP, jabatan aktif, jenis kepegawaian, status penugasan, status akun, dan status arsip.
- Pencarian tidak membedakan huruf besar dan kecil. Pencarian identifier mengabaikan spasi dan tanda baca yang tidak bermakna.
- Bulk edit dan bulk archive tidak termasuk rilis pertama. Impor massal ditentukan dalam tiket alur impor orang.

### Penyuntingan dan riwayat

- Data Warga Sekolah dapat disunting dari detail salah satu profil. Perubahan terlihat pada semua profil dan form memberi tahu School Admin ketika orang tersebut memiliki profil lain.
- Identifier dapat dikoreksi dengan validasi format dan keunikan ulang. Audit perubahan identifier sensitif menyimpan nilai sebelum dan sesudah.
- Perubahan status dan jabatan memakai tindakan khusus agar tanggal efektif, alasan, dan riwayat selalu tercatat; bukan form edit biasa.
- Catatan terarsip hanya dapat dibaca atau diaktifkan kembali. Catatan tidak dapat dipindahkan ke Tenant lain dan profil tidak dapat dikonversi menjadi jenis profil lain.
- Koreksi biasa menyimpan audit pelaku, waktu, operasi, dan catatan terdampak, tetapi generic full-field versioning tidak diwajibkan pada rilis pertama.

### Transisi status

- Setiap perubahan status menyimpan status asal, status tujuan, tanggal efektif, alasan, pelaku, dan waktu pencatatan.
- Guru atau Staf dapat berpindah dari `Aktif` ke `Cuti` atau `Berakhir`, dari `Cuti` ke `Aktif` atau `Berakhir`, dan dari `Berakhir` ke `Aktif` sebagai periode penugasan baru.
- Tanggal efektif boleh berada di masa lalu untuk migrasi atau koreksi, tetapi tidak boleh mendahului tanggal masuk atau mulai bertugas. Periode tidak boleh tumpang tindih.
- Perubahan terjadwal untuk masa depan tidak termasuk rilis pertama. Koreksi riwayat mencatat alasan dan nilai sebelumnya tanpa menghapus entri lama.

### Arsip dan aktivasi kembali

- Siswa hanya dapat diarsipkan setelah berstatus `Lulus`, `Pindah`, atau `Keluar`. Guru dan Staf hanya dapat diarsipkan setelah berstatus `Berakhir`; `Cuti` tidak cukup.
- Pengarsipan ditolak selama ada hubungan aktif yang menghalangi dan UI menampilkan setiap penghalang. Akun aktif menghasilkan peringatan, bukan penghalang.
- Profil terarsip tidak tampil pada daftar aktif secara default, tidak dapat disunting atau dipakai dalam hubungan baru, tetapi identitas, audit, riwayat, dan referensi lamanya tetap dapat dibaca.
- Pengarsipan profil tidak mengarsipkan Warga Sekolah secara otomatis. Warga Sekolah hanya dapat diarsipkan setelah semua profilnya diarsipkan.
- Aktivasi kembali menjalankan ulang validasi keunikan dan hubungan, tidak mengubah status lifecycle, tidak membuka kembali hubungan lama, serta tidak mengubah Akun Pengguna.
