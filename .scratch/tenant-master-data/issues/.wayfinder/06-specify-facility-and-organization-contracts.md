# Specify Sarana Prasarana and Organisasi Ekstrakurikuler contracts

Type: grilling
Status: resolved
Blocked by: 01, 02

## Question

What records and histories belong to Sarana & Prasarana, Organisasi Siswa, and Ekstrakurikuler; which fields, memberships, leadership roles, locations, assets, and relationships they require; and how creation, editing, listing, archive/reactivation, and referential constraints should behave?

## Answer

### Batas domain dan penyajian halaman

Halaman Organisasi & Ekstrakurikuler mengelola tiga jenis catatan domain yang tetap terpisah: Sarana & Prasarana, Organisasi Siswa, dan Ekstrakurikuler. Ketiganya boleh berbagi pola daftar, formulir, audit, dan arsip, tetapi tidak digabungkan menjadi satu entitas umum.

Halaman menyediakan tiga bagian utama: Lokasi & Aset, Organisasi Siswa, dan Ekstrakurikuler. Setiap bagian memiliki pencarian, filter status aktif/arsip, paginasi, serta tindakan buat, edit, arsip, dan reaktivasi. Daftar bawaan hanya menampilkan catatan aktif.

Detail Organisasi Siswa menampilkan periode kepengurusan, pengurus, dan anggota. Detail Ekstrakurikuler menampilkan Kelompok Kegiatan per Tahun Ajaran beserta pembina dan peserta. Detail aset menampilkan kondisi, lokasi, jumlah, dan riwayat perubahan.

### Lokasi/Ruang

Sarana & Prasarana membedakan Lokasi/Ruang dari Aset/Barang. Lokasi/Ruang memiliki:

- Nama.
- Kode yang unik di antara Lokasi/Ruang aktif dalam Tenant yang sama.
- Jenis lokasi, misalnya ruang kelas, laboratorium, lapangan, atau gudang.
- Kapasitas opsional.
- Keterangan opsional.
- Status arsip.
- Satu lokasi induk opsional dalam Tenant yang sama.

Hubungan induk-anak membentuk hierarki lokasi, tidak boleh membentuk siklus, dan tidak menghilangkan identitas mandiri setiap lokasi. Lokasi yang masih memiliki anak aktif tidak dapat diarsipkan. Pemindahan lokasi dalam hierarki tidak mengubah riwayat penempatan aset.

### Aset/Barang

Aset/Barang memiliki:

- Nama.
- Kode inventaris yang unik di antara Aset/Barang aktif dalam Tenant yang sama.
- Kategori aset.
- Cara pencatatan: kelompok atau individual.
- Jumlah untuk aset kelompok; jumlah selalu satu untuk aset individual.
- Kondisi: baik, rusak ringan, rusak berat, atau tidak layak.
- Lokasi aktif opsional.
- Tanggal perolehan opsional.
- Sumber perolehan opsional.
- Nilai perolehan opsional.
- Keterangan opsional.
- Status arsip.

Aset kelompok digunakan ketika unit sejenis tidak perlu dilacak satu per satu. Aset individual digunakan ketika setiap unit memerlukan identitas dan kondisi sendiri. Cara pencatatan tidak dapat diubah setelah catatan memiliki riwayat; kesalahan klasifikasi diselesaikan dengan mengarsipkan catatan lama dan membuat catatan baru.

Jumlah, kondisi, dan lokasi terkini tersedia langsung pada catatan aset. Setiap perubahan juga menghasilkan riwayat yang tidak dapat diedit atau dihapus, berisi waktu, School Admin pelaku, nilai sebelum dan sesudah, serta alasan atau catatan. Perubahan jumlah juga mencatat jenis perubahan seperti penambahan, pengurangan, koreksi, hilang, atau rusak/tidak layak. Perubahan lokasi mencatat lokasi asal dan tujuan.

Organisasi Siswa dan Ekstrakurikuler tidak memiliki hubungan terstruktur langsung untuk peminjaman atau penggunaan aset. Peminjaman, reservasi, penanggung jawab, dan penggunaan aset merupakan transaksi operasional di luar Master Data. Fitur operasional mendatang dapat merujuk ID stabil catatan ini.

### Organisasi Siswa

Organisasi Siswa memiliki:

- Nama.
- Singkatan opsional.
- Kode yang unik di antara Organisasi Siswa aktif dalam Tenant yang sama.
- Deskripsi opsional.
- Tanggal berdiri opsional.
- Lokasi sekretariat opsional yang merujuk Lokasi/Ruang aktif dalam Tenant yang sama.
- Status arsip.

Organisasi Siswa tidak memiliki kolom jenis karena nama organisasi sudah mewakili identitasnya.

Identitas organisasi tetap stabil melintasi beberapa Periode Kepengurusan. Setiap periode memiliki nama, tanggal mulai dan selesai, daftar pengurus, serta status direncanakan, aktif, atau selesai. Rentang periode dalam organisasi yang sama tidak boleh tumpang tindih dan hanya satu periode dapat aktif pada suatu waktu.

Jabatan pengurus ditentukan sekolah, dengan saran nama umum seperti Ketua, Wakil Ketua, Sekretaris, dan Bendahara. Penugasan jabatan mencatat Siswa, nama jabatan, tanggal mulai dan selesai dalam rentang Periode Kepengurusan, serta keterangan opsional. Seorang Siswa boleh memiliki lebih dari satu jabatan dalam periode yang sama. Satu jabatan hanya boleh memiliki satu pemegang pada waktu yang sama kecuali jabatan itu secara eksplisit memperbolehkan beberapa pemegang.

Keanggotaan Organisasi dicatat terpisah dari jabatan dan memuat Siswa, Organisasi Siswa, tanggal mulai dan selesai, status aktif atau selesai, serta keterangan opsional. Pengurus wajib memiliki keanggotaan aktif pada organisasi dan periode terkait; jika belum ada, keanggotaan harus dibuat terlebih dahulu. Berakhirnya jabatan tidak otomatis mengakhiri keanggotaan. Rentang keanggotaan Siswa yang sama dalam organisasi yang sama tidak boleh tumpang tindih.

### Ekstrakurikuler

Ekstrakurikuler memiliki:

- Nama.
- Kode yang unik di antara Ekstrakurikuler aktif dalam Tenant yang sama.
- Deskripsi opsional.
- Lokasi kegiatan bawaan opsional yang merujuk Lokasi/Ruang aktif dalam Tenant yang sama.
- Status arsip.

Identitas Ekstrakurikuler tetap stabil, sedangkan pelaksanaannya dicatat sebagai satu atau beberapa Kelompok Kegiatan dalam setiap Tahun Ajaran. Kelompok memungkinkan satu Ekstrakurikuler memiliki pembagian seperti Futsal Putra dan Futsal Putri.

Kelompok Kegiatan memiliki Ekstrakurikuler, Tahun Ajaran, nama kelompok, tanggal mulai dan selesai, kapasitas opsional, lokasi kegiatan opsional, jadwal teks opsional, serta status direncanakan, aktif, atau selesai. Nama kelompok unik dalam kombinasi Ekstrakurikuler dan Tahun Ajaran. Jika hanya ada satu kelompok, nama Ekstrakurikuler dapat menjadi nama bawaan.

Pembina Kelompok Kegiatan harus merujuk Guru atau Staf aktif dalam Tenant yang sama. Satu kelompok dapat memiliki beberapa pembina dan satu pembina dapat menangani beberapa kelompok. Penugasan mencatat peran seperti pembina utama, pendamping, atau pelatih; tanggal mulai dan selesai; serta keterangan opsional. Pelatih eksternal tidak menjadi hubungan terstruktur dalam lingkup ini dan dapat dicatat sementara dalam keterangan.

Peserta harus merujuk Siswa aktif dalam Tenant yang sama dan dicatat pada Kelompok Kegiatan tertentu. Keikutsertaan mencatat tanggal mulai dan selesai, status aktif atau selesai, serta keterangan opsional. Seorang Siswa boleh mengikuti beberapa Ekstrakurikuler atau kelompok, tetapi rentang keikutsertaannya tidak boleh tumpang tindih dalam kelompok yang sama. Kapasitas kelompok, jika diisi, merupakan batas keras bagi peserta aktif.

### Pembuatan, penyuntingan, dan riwayat

Semua hubungan hanya boleh merujuk catatan aktif dalam Tenant yang sama. ID internal setiap catatan stabil dan tidak dapat diubah. Nama dan kode bisnis boleh diubah selama aturan keunikan tetap terpenuhi; perubahan tidak memutus hubungan atau riwayat dan dicatat dalam audit. Nama lama boleh digunakan kembali, sedangkan kode catatan aktif tidak boleh duplikat dalam jenisnya.

Catatan yang direncanakan atau aktif dapat diedit selama tetap memenuhi aturan tanggal, status, kapasitas, keunikan, dan referensi. Catatan periode atau keanggotaan yang sudah selesai bersifat baca-saja. Kesalahan administratif diperbaiki melalui tindakan koreksi khusus yang menyimpan alasan, nilai sebelum dan sesudah, waktu, dan School Admin pelaku. Riwayat aset dikoreksi melalui entri penyesuaian baru, bukan dengan mengubah entri lama.

Catatan yang diarsipkan tetap dapat dibaca beserta seluruh hubungan dan riwayatnya, tetapi tidak dapat diedit atau dipakai dalam hubungan baru.

### Pengarsipan

Pengarsipan tidak menghentikan atau mengarsipkan hubungan secara otomatis. Pengarsipan ditolak sampai hubungan aktif diselesaikan secara eksplisit, dan sistem menunjukkan hubungan yang menghalanginya:

- Lokasi/Ruang tidak dapat diarsipkan jika memiliki anak aktif atau masih menjadi lokasi aktif aset, sekretariat organisasi, atau Kelompok Kegiatan.
- Organisasi Siswa tidak dapat diarsipkan jika masih memiliki Periode Kepengurusan, pengurus, atau anggota aktif.
- Ekstrakurikuler tidak dapat diarsipkan jika masih memiliki Kelompok Kegiatan aktif atau direncanakan.
- Kelompok Kegiatan tidak dapat diakhiri atau diarsipkan jika masih memiliki pembina atau peserta aktif.
- Aset dapat diarsipkan setelah School Admin mencatat alasan, misalnya hilang, dihapuskan, atau tidak layak.
- Siswa, Guru, atau Staf tidak dapat diarsipkan sampai jabatan, keanggotaan, keikutsertaan, atau penugasan pembina aktifnya diakhiri secara eksplisit.

Setelah Siswa, Guru, atau Staf diarsipkan, riwayat lama tetap tersedia tetapi orang tersebut tidak dapat dipilih untuk hubungan baru.

### Reaktivasi

Reaktivasi memvalidasi ulang keunikan, referensi, dan aturan yang berlaku saat ini. Jika kode sudah digunakan catatan aktif lain, kode harus diganti sebelum reaktivasi selesai. Reaktivasi tidak menghidupkan kembali hubungan lama secara otomatis:

- Organisasi Siswa dan Ekstrakurikuler tidak otomatis membuka periode, kelompok, jabatan, pembina, atau keanggotaan sebelumnya.
- Aset tidak otomatis kembali ke lokasi terakhir dan dapat diberi lokasi aktif baru secara eksplisit.
- Seluruh riwayat sebelum pengarsipan tetap dipertahankan.
