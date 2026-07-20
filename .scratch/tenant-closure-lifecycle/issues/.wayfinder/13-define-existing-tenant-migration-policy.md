# Tetapkan migrasi Tenant yang sudah ada ke lifecycle baru

Type: grilling
Status: resolved
Blocked by: 01, 04, 05

## Question

Bagaimana seluruh Tenant yang sudah ada diberi status operasional dan konfigurasi Masa Tunggu Penghapusan awal; bagaimana data atau kondisi lama yang tidak memenuhi invariant ditangani; serta strategi rollout, kompatibilitas, dan rollback apa yang menjaga akses Tenant tetap aman selama model lifecycle baru diperkenalkan?

## Answer

Migrasi menggunakan prinsip **fail-open untuk akses operasional yang telah berjalan dan fail-closed untuk tindakan lifecycle baru**. Migrasi tidak boleh mengubah data historis menjadi otorisasi Penutupan Tenant atau Penghapusan Tenant.

### Status awal Tenant

- Tenant lama yang saat ini dapat digunakan diberi status operasional `active`.
- Kondisi lama hanya dipetakan ke `closed` jika sumber dan maknanya tepercaya serta benar-benar setara dengan Penutupan Tenant.
- Kondisi ambigu tetap `active`, ditandai `needs_reconciliation`, dan tidak boleh menjalankan tindakan lifecycle destruktif sampai Provider menyelesaikan rekonsiliasi.
- Migrasi tidak membuat `Kasus Penutupan Tenant` sintetis, jadwal penghapusan, atau kewenangan Penghapusan Tenant.
- Kerusakan yang mengancam isolasi Tenant atau otorisasi akses tidak disamarkan sebagai `closed`; Tenant dikeluarkan dari migrasi otomatis dan ditangani sebagai masalah keamanan oleh Provider.

### Konfigurasi Masa Tunggu Penghapusan

- Setiap Tenant lama memperoleh konfigurasi awal 30 hari.
- Nilai lama yang semakna boleh dipertahankan hanya jika asalnya tepercaya dan nilainya valid dalam rentang 1–365 hari kalender.
- Nilai kosong, tidak valid, atau ambigu dinormalisasi menjadi 30 hari dan dicatat dalam laporan rekonsiliasi.
- Konfigurasi ini bukan jadwal penghapusan. Nilainya baru disalin sebagai snapshot tenggat ketika Provider Admin menyetujui Penutupan Tenant.
- Perubahan konfigurasi setelah persetujuan tidak mengubah tenggat kasus yang sedang berjalan.

### Penanganan pelanggaran invariant

Temuan migrasi dibagi menjadi tiga kelas:

1. **Aman diperbaiki otomatis** — normalisasi dilakukan secara deterministik dan dicatat, misalnya mengganti Masa Tunggu Penghapusan kosong atau di luar rentang dengan 30 hari.
2. **Ambigu tetapi Tenant masih dapat digunakan** — Tenant tetap `active` dan operasi sekolah tetap tersedia, tetapi diberi `needs_reconciliation` serta diblokir dari persetujuan Penutupan, penjadwalan, dan Penghapusan Tenant.
3. **Tidak aman untuk dioperasikan** — kondisi yang mengancam isolasi atau otorisasi mengikuti penanganan keamanan yang sudah berlaku, dikeluarkan dari migrasi otomatis, dan memerlukan intervensi Provider.

Setiap pengecualian masuk ke laporan migrasi terstruktur yang memuat alasan, tindakan otomatis, dan status penyelesaiannya. Tidak ada kondisi invalid yang boleh otomatis menghasilkan `Kasus Penutupan Tenant` atau jadwal Penghapusan Tenant.

### Rollout dan kompatibilitas

Rollout dilakukan bertahap melalui `expand → backfill → verify → activate → contract`:

1. **Expand** — tambahkan struktur lifecycle baru secara aditif dan kompatibel; jalur lama tetap menentukan akses dan tindakan lifecycle baru belum tersedia.
2. **Backfill** — migrasikan Tenant dalam batch kecil yang idempotent dan dapat dilanjutkan, dengan versi serta hasil klasifikasi per Tenant.
3. **Verify** — lakukan shadow verification terhadap keputusan akses model lama dan baru. Perbedaan dicatat dan direkonsiliasi tanpa membiarkan model baru memutus akses.
4. **Activate** — aktifkan pembacaan model baru dengan feature flag, mulai dari Provider/internal cohort, Tenant terpilih, lalu seluruh Tenant. UI dan API lifecycle hanya tersedia bagi Tenant yang telah terverifikasi.
5. **Contract** — hentikan kompatibilitas lama hanya setelah seluruh kriteria cutover dipenuhi.

Jika data lifecycle baru belum tersedia atau belum terverifikasi, keputusan akses tetap mengikuti model lama dan semua tindakan lifecycle baru ditolak.

### Rollback

Rollback mengembalikan versi aplikasi atau aktivasi fitur, bukan membatalkan data dan keputusan lifecycle:

- Matikan pembuatan serta perubahan lifecycle baru melalui feature flag.
- Pertahankan status operasional, `Kasus Penutupan Tenant`, tenggat, dan audit yang sudah tercatat.
- Compatibility adapter versi lama wajib mengenali sekurangnya status `closed`, sehingga rollback tidak membuka kembali Tenant.
- Tenant `closed` tetap hanya memperoleh Halaman Status Tenant atau fallback aman yang setara.
- Tahan persetujuan baru, perubahan jadwal, pembukaan kembali, dan konfirmasi Penghapusan Tenant sampai versi baru sehat kembali.
- Tahan Penghapusan Tenant yang belum dimulai.
- `Eksekusi Penghapusan Tenant` yang sudah dimulai tetap mengikuti mekanisme durable dan dapat dilanjutkan; proses ini tidak di-rollback dengan memulihkan data.
- Backfill aditif tidak dibalik; kegagalan ditangani dengan perbaikan maju.
- Sebelum aktivasi produksi, uji compatibility adapter dan versi sebelumnya terhadap Tenant `active`, Tenant `closed`, serta Tenant dengan kasus berjalan.

### Cutover dan penghentian kompatibilitas

Model baru hanya boleh menjadi sumber kebenaran ketika:

- 100% Tenant memiliki status operasional dan konfigurasi Masa Tunggu Penghapusan yang valid;
- seluruh batch migrasi selesai dan dapat diverifikasi ulang secara deterministik;
- tidak ada perbedaan keputusan akses yang belum diselesaikan;
- seluruh `needs_reconciliation` telah diselesaikan atau secara eksplisit dikecualikan dengan tindakan lifecycle tetap diblokir;
- tidak ada aplikasi, worker, atau job lama yang masih menulis representasi lama;
- compatibility adapter melewati masa observasi produksi tanpa insiden akses akibat migrasi;
- laporan rekonsiliasi akhir tersedia dan Provider menyetujui cutover;
- pemulihan backup telah diuji agar snapshot lama tidak menghilangkan status `closed` atau menghidupkan kembali kemampuan lifecycle yang dibatasi.

Setelah cutover 100%, pertahankan compatibility writing selama masa observasi minimum 14 hari. Kemudian jadikan field lama read-only. Struktur lama baru boleh dihapus dalam deployment terpisah setelah masa observasi tambahan 14 hari.
