# Tetapkan kewenangan dan kebijakan persetujuan lifecycle

Type: grilling
Status: resolved
Blocked by: 01

## Question

Siapa yang dapat memulai, menyetujui, menolak, membatalkan, membuka kembali, mengubah jadwal, meminta ekspor, dan mengonfirmasi Penghapusan Tenant pada setiap alur; serta autentikasi ulang, alasan wajib, pemisahan tugas, dan penanganan beberapa School Admin apa yang diperlukan?

## Answer

### School Admin

- School Admin hanya dapat mengajukan Penutupan Tenant; tidak ada pengajuan Penghapusan Tenant terpisah. Persetujuan penutupan membuat jadwal penghapusan, sedangkan konfirmasi akhir hanya dapat dilakukan Provider Admin.
- Setiap School Admin aktif dapat mengajukan penutupan. Hanya satu Kasus Penutupan Tenant berjalan, sehingga pengajuan berikutnya menggunakan kasus yang sama dan tidak membuat duplikat.
- Setiap School Admin aktif dapat membatalkan pengajuan yang masih ditinjau, termasuk pengajuan admin lain.
- Setelah Tenant ditutup, setiap School Admin aktif dapat meminta Pembukaan Kembali. Permintaan ini tidak langsung mengaktifkan Tenant dan harus diputuskan Provider Admin.
- Satu tindakan School Admin cukup; tidak diperlukan voting atau persetujuan School Admin lain.
- Kasus tetap berjalan jika pengaju kehilangan role atau akunnya dinonaktifkan. Seluruh School Admin aktif dapat melihat perubahan kasus melalui Halaman Status Tenant dan riwayat kasus; notifikasi proaktif ditunda.
- School Admin dapat melihat tenggat, tetapi tidak dapat memilih atau mengubahnya dan tidak memiliki aksi khusus untuk meminta perubahan melalui workflow lifecycle.

### Provider Admin

- Setiap Provider Admin aktif dapat menyetujui atau menolak pengajuan penutupan, memulai Penutupan Tenant secara langsung, menyetujui atau menolak Pembukaan Kembali, membuka kembali atas inisiatif Provider, memilih atau mengubah tenggat, memproses ekspor, memberikan konfirmasi akhir Penghapusan Tenant, dan mencoba ulang penghapusan yang gagal.
- Penutupan yang dimulai Provider langsung menutup Tenant tanpa persetujuan tambahan. School Admin tidak dapat membatalkannya secara sepihak, tetapi dapat meminta Pembukaan Kembali.
- Provider Admin yang memulai atau menyetujui penutupan tetap boleh mengonfirmasi penghapusan. Tidak ada kewajiban dua Provider Admin berbeda; autentikasi ulang, konfirmasi eksplisit, blocker, dan audit menjadi perlindungannya.
- Pembukaan kembali tidak tersedia setelah kasus masuk `deletion_in_progress`; tindakan yang tersedia hanya penyelesaian atau pemulihan kegagalan penghapusan.

### Autentikasi ulang

Autentikasi ulang wajib ketika:

- School Admin mengajukan Penutupan Tenant;
- School Admin meminta Pembukaan Kembali setelah Tenant ditutup;
- Provider Admin memulai Penutupan Tenant langsung;
- Provider Admin memperpendek tenggat yang sudah ditetapkan;
- Provider Admin memberikan konfirmasi akhir Penghapusan Tenant;
- Provider Admin mencoba ulang penghapusan yang gagal.

Persetujuan, penolakan, perpanjangan tenggat, dan pemrosesan ekspor dapat menggunakan sesi aktif, tetapi tetap diaudit.

### Alasan dan konfirmasi

Alasan wajib untuk:

- School Admin mengajukan Penutupan Tenant;
- School Admin lain membatalkan pengajuan sebelum disetujui;
- School Admin meminta Pembukaan Kembali;
- Provider Admin menolak penutupan;
- Provider Admin memulai Penutupan Tenant langsung;
- Provider Admin menolak Pembukaan Kembali;
- Provider Admin mengubah tenggat yang sedang berjalan;
- Provider Admin mencoba ulang penghapusan yang gagal.

Catatan Provider bersifat opsional saat menyetujui penutupan atau Pembukaan Kembali. Konfirmasi akhir penghapusan menggunakan autentikasi ulang dan konfirmasi eksplisit yang menyebut identitas Tenant, bukan sekadar kolom alasan.

### Ekspor data

- Setiap School Admin aktif dapat meminta ekspor; hanya satu ekspor aktif per Kasus Penutupan Tenant.
- Provider Admin dapat menyetujui, menolak, memproses, atau memulai ekspor atas nama sekolah.
- Hasil ekspor hanya dapat diunduh oleh School Admin peminta dan Provider Admin.
- Jika peminta kehilangan role, Provider Admin dapat menetapkan School Admin aktif pengganti dan perubahan tersebut diaudit.

### Evaluasi kewenangan

- Setiap tindakan memeriksa role, status akun, dan sesi pada saat tindakan dilakukan; kewenangan tidak dibekukan ketika kasus dibuat.
- Kehilangan role `school-admin`, penonaktifan akun, atau pencabutan sesi langsung menghilangkan kewenangan lifecycle.
- Pengguna yang menjadi School Admin ketika kasus sudah berjalan memperoleh kewenangan School Admin yang sama.
- Riwayat tetap mempertahankan identitas dan role aktor pada saat tindakan dilakukan meskipun kemudian berubah.
