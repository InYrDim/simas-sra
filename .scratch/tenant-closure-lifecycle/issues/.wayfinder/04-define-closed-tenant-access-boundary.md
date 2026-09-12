# Tetapkan batas akses Tenant yang ditutup

Type: grilling
Status: resolved
Blocked by: 01, 02

## Question

Permukaan apa yang tetap dapat diakses oleh siapa selama Tenant ditutup—termasuk login, halaman status terbatas, situs publik, API, sesi yang sudah aktif, background job, dan akses Provider—serta bagaimana batas tersebut ditegakkan secara konsisten?

## Answer

### Pengguna sekolah dan login

- Penutupan Tenant tidak menonaktifkan identitas pengguna karena identitas dapat terhubung ke Tenant lain.
- School Admin aktif hanya dapat membuka Halaman Status Tenant untuk melihat keadaan Tenant, alasan penutupan, tenggat, status ekspor, dan riwayat kasus serta menjalankan tindakan lifecycle yang masih menjadi kewenangannya.
- Pengguna sekolah selain School Admin tidak dapat memasuki ruang kerja atau melihat detail kasus; mereka hanya menerima pemberitahuan netral bahwa Tenant ditutup.
- Dashboard, data operasional, dan fungsi administrasi sekolah tidak tersedia melalui UI Tenant biasa.

### Situs publik

- Situs publik sekolah dinonaktifkan selama Tenant ditutup dan menampilkan halaman netral tanpa alasan penutupan, tenggat, atau detail internal.
- Domain atau subdomain tetap dipertahankan agar tidak diambil alih dan dapat digunakan kembali jika Tenant dibuka.
- Konten lama tidak boleh tetap dilayani dari cache atau CDN setelah penutupan efektif.

### API, kredensial, dan sesi aktif

- Seluruh API operasional Tenant ditolak untuk sesi pengguna, API key, service account, integrasi pihak ketiga, webhook masuk, serta operasi baca maupun tulis.
- Hanya endpoint lifecycle terbatas yang mendukung Halaman Status Tenant dan memeriksa kewenangan School Admin yang dikecualikan.
- Penolakan menggunakan error domain stabil seperti `TENANT_CLOSED`; detail sensitif hanya diberikan kepada aktor berwenang.
- Penutupan berlaku segera terhadap sesi aktif. Otorisasi Tenant diperiksa pada setiap request, koneksi real-time diputus, dan perubahan yang belum tersimpan tidak diterima setelah penutupan.
- Sesi identitas global tidak dicabut. School Admin diarahkan ke Halaman Status Tenant, sedangkan pengguna lain dikeluarkan dari ruang kerja.

### Background job

- Job operasional seperti sinkronisasi, impor, otomasi, laporan terjadwal, pengiriman konten, dan webhook keluar dihentikan atau dilewati.
- Job lifecycle, ekspor, pemberitahuan lifecycle, audit, keamanan, evaluasi tenggat, penghapusan, pemulihan kegagalan, dan pemeliharaan integritas tetap dapat berjalan.
- Job memeriksa status Tenant saat mulai dan sebelum side effect penting. Job operasional yang sudah berjalan berhenti secara aman dan dicatat sebagai dilewati atau dihentikan karena `TENANT_CLOSED`, tanpa retry tanpa batas.

### Provider Admin

- Provider Admin tetap dapat menggunakan konsol lifecycle untuk melihat kasus dan metadata, memutuskan Pembukaan Kembali, mengubah tenggat, memproses ekspor, memeriksa blocker, mengonfirmasi atau mencoba ulang penghapusan, serta melakukan audit dan diagnosis teknis.
- Akses normal atau impersonation ke ruang kerja yang ditutup ikut diblokir.
- Akses data operasional hanya melalui mekanisme dukungan khusus yang membutuhkan alasan, dibatasi pada data dan durasi yang diperlukan, diaudit, dan tidak mengaktifkan fungsi operasional Tenant.

### Penegakan

- Semua entry point memakai kebijakan otorisasi terpusat dengan prinsip deny-by-default dan allowlist kapabilitas lifecycle yang eksplisit.
- Kebijakan berlaku pada UI, API, situs publik, worker, cron, webhook, koneksi real-time, dan akses Provider.
- Status operasional terbaru menjadi sumber kebenaran. Cache hanya boleh digunakan dengan invalidasi terjamin saat penutupan atau pembukaan kembali; kegagalan membaca status bersifat fail closed untuk operasi Tenant.
- Entry point baru tidak mendapat pengecualian secara default. Setiap pengecualian harus bernama, dapat diuji, dan diaudit bila sensitif.

### Pembukaan Kembali

- Role, API key, integrasi, domain, dan konfigurasi yang masih valid dapat digunakan kembali. Sesi identitas yang masih valid memperoleh akses setelah evaluasi status terbaru, sedangkan koneksi real-time dibuat ulang.
- Kredensial atau sesi yang telah dicabut, kedaluwarsa, atau dinonaktifkan tidak dipulihkan.
- Jadwal operasional berlanjut dari waktu pembukaan kembali tanpa menjalankan ulang job, webhook, laporan, atau notifikasi yang terlewat. Backfill hanya melalui tindakan terpisah dan eksplisit.
- Situs publik tersedia kembali setelah invalidasi cache status selesai.
