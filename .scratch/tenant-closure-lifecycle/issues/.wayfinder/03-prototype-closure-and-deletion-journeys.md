# Konkretkan perjalanan Penutupan dan Penghapusan Tenant

Type: prototype
Status: resolved
Blocked by: 01, 02

## Question

Bagaimana pengalaman School Admin dan Provider Admin harus terlihat dan berperilaku dari pengajuan, peninjauan, pemberitahuan persetujuan, hitung mundur, ekspor, pembatalan, pembukaan kembali, hingga konfirmasi Penghapusan Tenant agar konsekuensi dan tindakan yang tersedia tidak ambigu?

## Answer

Gunakan pola **Perjalanan terpandu** dari Variant B sebagai pola canonical untuk School Admin dan Provider Admin.

### Struktur pengalaman

- Tampilkan satu tahap aktif dengan judul berorientasi tugas, status kasus, penjelasan singkat, konsekuensi, dan satu tindakan utama; jangan menampilkan semua tindakan lifecycle sekaligus.
- Letakkan daftar tahap vertikal sebagai orientasi: Pengajuan, Peninjauan, Masa Tunggu, Pembukaan Kembali, Siap Dihapus, dan Selesai. Tahap lampau, aktif, dan mendatang harus dapat dibedakan tanpa menyiratkan bahwa seluruh tahap pasti terjadi.
- Pertahankan struktur dan istilah yang sama bagi kedua role, tetapi sesuaikan tindakan utama dan detail kewenangan. School Admin melihat perjalanan melalui Halaman Status Tenant; Provider Admin melalui konsol lifecycle Tenant.
- Pisahkan status operasional Tenant, status Kasus Penutupan Tenant, tenggat, status ekspor, dan blocker. Jangan melebur semuanya menjadi satu label status atau progress bar linear.
- Setiap tampilan tahap harus menjawab: keadaan Tenant sekarang, apa yang terjadi pada data, apakah masih dapat dipulihkan, siapa yang harus bertindak, dan apa yang terjadi berikutnya.

### Perilaku per tahap

- **Pengajuan:** sebelum School Admin mengajukan, tampilkan bahwa Tenant tetap aktif selama peninjauan, Penutupan Tenant dapat berujung pada jadwal Penghapusan Tenant, alasan wajib, dan autentikasi ulang. Setelah dikirim, tampilkan identitas pengaju dan waktu pengajuan.
- **Peninjauan:** tampilkan Tenant masih aktif, batas peninjauan 14 hari, alasan pengajuan, riwayat, serta pembatalan bagi School Admin. Provider mendapat keputusan setujui atau tolak; persetujuan harus sekaligus mengonfirmasi jumlah hari masa tunggu sebelum Tenant ditutup.
- **Persetujuan dan masa tunggu:** setelah persetujuan atau Penutupan langsung oleh Provider, arahkan School Admin ke Halaman Status Tenant. Tampilkan waktu penutupan, tenggat absolut beserta zona waktu, hitung mundur sebagai informasi sekunder, status ekspor, dan tindakan meminta Pembukaan Kembali. Jelaskan bahwa data masih disimpan tetapi operasi Tenant dan situs publik tidak tersedia.
- **Ekspor:** tampilkan ekspor sebagai proses tersendiri dengan status, peminta, dan tindakan yang tersedia. Ekspor aktif tidak menghentikan hitung mundur atau status siap dihapus, tetapi menjadi blocker konfirmasi akhir Penghapusan Tenant.
- **Pembatalan dan Pembukaan Kembali:** pembatalan sebelum persetujuan mengakhiri pengajuan dan Tenant tetap aktif. Setelah Tenant ditutup, gunakan istilah meminta Pembukaan Kembali, bukan membatalkan penghapusan. Selama peninjauan pembukaan kembali, tampilkan bahwa penghapusan diblokir tetapi tenggat tidak bergeser.
- **Siap dihapus:** tampilkan bahwa tenggat telah tercapai tetapi tidak ada penghapusan otomatis. Provider melihat checklist syarat terkini dan blocker spesifik. School Admin tetap melihat status kasus dan ekspor yang masih menjadi haknya.
- **Konfirmasi akhir:** gunakan layar fokus terpisah dari tindakan rutin. Sebut nama, domain, dan identifier Tenant; bedakan Penutupan Tenant yang dapat dipulihkan dari Penghapusan Tenant yang permanen; tampilkan cakupan data yang dihapus dan identitas pengguna yang tidak otomatis dihapus; lalu minta autentikasi ulang dan konfirmasi eksplisit identitas Tenant.
- **Eksekusi dan hasil:** selama `deletion_in_progress`, nonaktifkan tindakan lifecycle lain dan tampilkan progres tanpa menjanjikan waktu selesai. Keberhasilan mengarah ke ringkasan final dan Catatan Penghapusan Tenant; kegagalan menampilkan penyebab yang dapat ditindaklanjuti serta retry khusus Provider.

### Aturan kejelasan

- Tindakan destruktif tidak boleh hanya dibedakan lewat warna; label harus menyebut objek dan akibatnya secara eksplisit.
- Tampilkan tanggal dan waktu absolut sebagai sumber kebenaran. Hitung mundur membantu pemindaian tetapi tidak menggantikan tenggat dan zona waktu.
- Notifikasi membawa pengguna ke tahap aktif yang sama, bukan menjadi satu-satunya tempat konsekuensi dijelaskan.
- Jika kewenangan atau blocker berubah sejak halaman dimuat, tolak tindakan dengan alasan spesifik dan muat ulang keadaan kasus.
- Audit dan riwayat selalu tersedia sebagai konteks sekunder, bukan bersaing dengan tindakan utama.

### Asset prototype

Prototype interaktif berada di route throwaway `/tenant-closure-prototype`; Variant B dapat dibuka dengan `?variant=B`. Prototype memakai state lokal dan tidak terhubung ke mutation atau database.
