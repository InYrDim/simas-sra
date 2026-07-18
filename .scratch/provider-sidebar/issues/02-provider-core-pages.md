Type: grilling
Status: resolved

## Question

Informasi, tindakan, dan batas fungsional apa yang wajib tersedia pada halaman Ringkasan dan Tenant di versi pertama, berdasarkan data serta alur onboarding yang sudah ada?

## Answer

Pisahkan halaman Provider menjadi **Ringkasan** untuk perhatian operasional dan **Tenant** untuk pengelolaan daftar, pengajuan, serta detail. Provider tidak melakukan onboarding sekolah: sekolah mengirim **Pengajuan SIMAS**, Provider menyetujui dan menyediakan Tenant, lalu sekolah melakukan **Onboarding Tenant** untuk menginisialisasi SIMAS.

### Ringkasan

Tampilkan empat metrik yang dapat ditindaklanjuti:

- Pengajuan menunggu peninjauan.
- Total Tenant yang sudah disediakan.
- Tenant menunggu onboarding.
- Trial segera berakhir, yaitu trial yang berakhir dalam tujuh hari.

Di bawah metrik, tampilkan maksimal lima pengajuan terbaru dan lima Tenant terbaru. Tindakan utama adalah **Lihat Pengajuan**; Provider tidak membuat Tenant dengan melewati pengajuan. Jangan menduplikasi daftar Tenant lengkap pada Ringkasan.

### Halaman Tenant

Gunakan tab **Tenant** dan **Pengajuan** pada `/provider/tenants`.

Tab Tenant memuat pencarian berdasarkan nama sekolah, NPSN, subdomain, atau email School Admin; filter tahap penggunaan; pengurutan tanggal dan nama; serta pagination. Kolom minimum adalah nama sekolah, NPSN, subdomain, School Admin pertama, tahap penggunaan, dan tanggal persetujuan. Tahap penggunaan terdiri dari **Menunggu onboarding**, **Dalam trial**, **Segera berakhir**, dan **Trial berakhir**.

Setiap Tenant memiliki tindakan **Lihat detail** dan **Buka situs Tenant**. Membuka situs tidak membuat sesi Tenant dan bukan impersonasi. Jangan menyediakan edit, hapus, suspend, perpanjangan trial, pengaturan fitur, atau impersonasi pada versi pertama.

Detail Tenant menampilkan identitas sekolah dan Tenant, School Admin pertama beserta status akun, tanggal persetujuan, status onboarding, periode trial, dan ringkasan pengajuan asal. Kredensial sementara dapat di-reset hanya sebelum login pertama dan hasilnya ditampilkan satu kali; setelah akun aktif, gunakan alur reset kata sandi biasa.

### Pengajuan SIMAS

Form registrasi sekolah mengumpulkan nama resmi sekolah, NPSN, jenjang, alamat, nama dan jabatan penanggung jawab, email, nomor WhatsApp, serta catatan kebutuhan opsional. Sekolah tidak memilih subdomain.

Status pengajuan adalah **Menunggu peninjauan**, **Disetujui**, atau **Ditolak**. Daftar Pengajuan dapat dicari, difilter, diurutkan, dan dipaginasi. Detail peninjauan menampilkan seluruh data serta konflik NPSN dan email terhadap pengajuan atau Tenant lain.

Provider Admin hanya boleh menetapkan subdomain saat approval; data asli pengajuan tidak diedit. Sistem menyarankan slug nama sekolah, tetapi Provider dapat mengubahnya dan approval harus gagal bila subdomain tidak valid atau telah digunakan. Jika data sekolah salah atau kurang, Provider menolak dengan alasan wajib dan sekolah mengirim pengajuan baru. Tidak ada revisi, approval bertingkat, pembatalan keputusan, atau pengajuan ulang otomatis pada versi pertama.

Approval harus secara atomik menandai pengajuan disetujui, membuat Tenant, membuat School Admin pertama dari penanggung jawab, dan menghasilkan kata sandi sementara. Kredensial hanya ditampilkan sekali untuk disampaikan tim SIMAS melalui kanal resmi, tidak disimpan sebagai teks biasa, dan wajib diganti saat login pertama. Pengajuan yang telah diputuskan tetap tersedia sebagai riwayat baca-saja.

### Onboarding dan trial

Login pertama tidak menyelesaikan onboarding dan tidak memulai trial. Sekolah menyelesaikan langkah akhir eksplisit dalam Onboarding Tenant; sistem kemudian mencatat `onboardingCompletedAt`, `trialStartedAt`, dan `trialEndsAt` dalam satu transaksi. Sebelum itu Tenant berstatus **Menunggu onboarding**. Progres onboarding parsial tidak ditampilkan pada area Provider versi pertama.

### Batas dan dampak

Alur lama `/dashboard/onboarding` bukan onboarding dan tidak dipertahankan sebagai formulir Provider. Penyediaan Tenant berasal dari approval Pengajuan SIMAS. Registrasi auth mandiri tidak boleh membentuk Tenant atau School Admin pertama.

Schema saat ini belum memiliki pengajuan, status onboarding, waktu mulai trial, atau autentikasi email/password yang bekerja. Rancangan schema, transisi state, transaksi approval, serta integrasi Better Auth diselesaikan dalam [Rancang lifecycle Pengajuan SIMAS dan Tenant](08-tenant-application-lifecycle.md).
