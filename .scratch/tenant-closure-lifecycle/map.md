# Lifecycle Penutupan dan Penghapusan Tenant

Label: wayfinder:map

## Destination

Menghasilkan spesifikasi implementasi lifecycle Tenant dari pengajuan Penutupan Tenant, peninjauan Provider, masa tunggu per Tenant, pembatalan dan pembukaan kembali, ekspor data, hingga konfirmasi Penghapusan Tenant permanen—untuk alur yang dimulai School Admin maupun Provider Admin.

## Notes

- Gunakan `/grilling` dan `/domain-modeling` untuk keputusan domain; gunakan `/prototype` ketika perilaku UI perlu dibuat konkret.
- Ini adalah map perencanaan. Implementasi dimulai setelah seluruh keputusan yang diperlukan destination telah terselesaikan.
- Penutupan Tenant dapat dipulihkan dan tidak menghapus data; Penghapusan Tenant bersifat permanen.
- Lifecycle tingkat tinggi: `Aktif → Ditutup → Dibuka kembali atau Dihapus`.
- School Admin hanya mengajukan Penutupan Tenant; persetujuannya otomatis membuat jadwal penghapusan. Provider Admin menyetujui atau menolak dan juga dapat memulai Penutupan Tenant langsung.
- Tenant langsung ditutup ketika Provider Admin menyetujui penutupan. School Admin hanya mendapat akses terbatas selama Tenant ditutup.
- Pembatalan oleh School Admin setelah persetujuan membatalkan jadwal penghapusan dan mengajukan Pembukaan Kembali Tenant untuk ditinjau Provider Admin.
- Masa Tunggu Penghapusan default 30 hari, dapat diubah per Tenant hanya oleh Provider Admin, dan dipilih saat persetujuan penutupan.
- Setelah masa tunggu, Tenant menjadi siap dihapus; Penghapusan Tenant tetap memerlukan konfirmasi akhir Provider Admin.
- Semua School Admin dapat mengajukan atau membatalkan dengan autentikasi ulang; perubahan tersedia melalui Halaman Status Tenant dan seluruh tindakannya diaudit. Notifikasi proaktif ditunda.
- Ekspor data harus tersedia selama masa tunggu dan Penghapusan Tenant diblokir selama ekspor masih diproses.
- Penghapusan Tenant menghapus ruang kerja dan data sekolah; identitas pengguna yang masih mempunyai hubungan lain dengan SIMAS tidak ikut dihapus.
- Gunakan istilah canonical dari [`CONTEXT.md`](../../CONTEXT.md), khususnya Penutupan Tenant dan Penghapusan Tenant; hindari “Penutupan Akun”.

## Decisions so far

- [Tetapkan model status lifecycle Tenant](issues/.wayfinder/01-define-tenant-lifecycle-state-model.md) — Pisahkan status operasional `active`/`closed` dari Kasus Penutupan Tenant yang mengelola review, penutupan, pembukaan kembali, dan Penghapusan Tenant sampai hasil final.
- [Tetapkan kewenangan dan kebijakan persetujuan lifecycle](issues/.wayfinder/02-define-authority-and-approval-policy.md) — Semua School Admin aktif dapat mengajukan penutupan atau pembukaan kembali, sedangkan Provider Admin memegang keputusan, jadwal, ekspor, dan konfirmasi akhir dengan autentikasi ulang serta audit untuk tindakan sensitif.
- [Tetapkan kebijakan penjadwalan Penghapusan Tenant](issues/.wayfinder/05-define-deletion-scheduling-policy.md) — Snapshot tenggat memakai 1–365 hari kalender dengan default 30 hari; Provider dapat mengubahnya secara terkendali, sementara tenggat menentukan kesiapan dan blocker hanya menahan konfirmasi akhir.
- [Tetapkan batas akses Tenant yang ditutup](issues/.wayfinder/04-define-closed-tenant-access-boundary.md) — Blokir semua operasi Tenant secara terpusat dan deny-by-default, sisakan Halaman Status Tenant serta kapabilitas lifecycle terbatas, dan pulihkan akses tanpa replay otomatis saat dibuka kembali.
- [Konkretkan perjalanan Penutupan dan Penghapusan Tenant](issues/.wayfinder/03-prototype-closure-and-deletion-journeys.md) — Gunakan perjalanan terpandu bertahap dengan satu tindakan utama, konsekuensi eksplisit, dan pemisahan status Tenant, status kasus, tenggat, ekspor, serta blocker untuk kedua role.
- [Tetapkan kontrak ekspor data sebelum penghapusan](issues/.wayfinder/06-define-data-export-contract.md) — Sediakan Paket Ekspor Tenant lengkap dan aman sebagai snapshot versioned selama tujuh hari; proses aktif atau kegagalan yang belum diselesaikan memblokir konfirmasi penghapusan secara atomik.
- [Tetapkan kebijakan notifikasi dan audit lifecycle](issues/.wayfinder/08-define-notification-and-audit-policy.md) — Tunda notifikasi proaktif; sediakan riwayat lifecycle bagi role terkait dan pertahankan audit append-only yang atomik, terbatas aksesnya, serta diretensi lima tahun.
- [Tetapkan pemulihan kegagalan Penghapusan Tenant](issues/.wayfinder/09-define-deletion-failure-recovery.md) — Jalankan penghapusan sebagai eksekusi bertahap yang durable, idempotent, dipagari dari penulisan ulang, dapat dilanjutkan tanpa rollback, dan hanya difinalisasi setelah semua lokasi wajib terverifikasi bersih.
- [Tetapkan batas data Penghapusan Tenant](issues/.wayfinder/07-define-deletion-data-boundary.md) — Hapus seluruh data dan identitas yang bergantung pada Tenant dari semua lokasi aktif, minimalkan riwayat Provider, dan terbitkan Catatan Penghapusan Tenant hanya setelah verifikasi menyeluruh.
- [Tetapkan retensi backup dan arti permanen](issues/.wayfinder/10-define-backup-retention-and-permanence.md) — Batasi backup terisolasi hingga 90 hari, cegah data terhapus hidup kembali saat pemulihan, dan bedakan penyelesaian penghapusan aktif dari permanensi di seluruh penyimpanan.
- [Tetapkan dampak lifecycle terhadap billing dan subscription](issues/.wayfinder/11-define-billing-subscription-lifecycle-impact.md) — Hentikan biaya baru saat Tenant ditutup, kreditkan proration, aktifkan subscription baru saat dibuka kembali, dan pisahkan penyelesaian kewajiban finansial dari Penghapusan Tenant.
- [Tetapkan operasi dukungan setelah Penghapusan Tenant](issues/.wayfinder/12-define-post-deletion-support-policy.md) — Batasi dukungan pada bukti minimal dan akses terkontrol, verifikasi sekolah secara independen, serta izinkan koreksi atau remediasi tanpa membuka jalur pemulihan data.
- [Tetapkan migrasi Tenant yang sudah ada ke lifecycle baru](issues/.wayfinder/13-define-existing-tenant-migration-policy.md) — Migrasikan secara aditif dengan akses lama tetap aman, blokir lifecycle pada data ambigu, lalu lakukan cutover dan penghentian kompatibilitas melalui verifikasi serta observasi bertahap.

## Not yet specified

Tidak ada fog yang tersisa saat ini.

## Out of scope

- Lifecycle penghapusan identitas independen berada di luar map ini; identitas yang hanya hidup dalam Tenant tetap dihapus sebagai bagian Penghapusan Tenant.
- Implementasi kode; destination map ini adalah spesifikasi siap diimplementasikan.
