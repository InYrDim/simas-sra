# Tetapkan kebijakan penjadwalan Penghapusan Tenant

Type: grilling
Status: resolved
Blocked by: 01, 02

## Question

Bagaimana nilai default 30 hari dan override per Tenant diterapkan saat Provider menyetujui penutupan; kapan tenggat menjadi snapshot; perubahan apa yang boleh memperpanjang atau mempersingkat jadwal; dan kondisi apa yang memblokir perpindahan ke siap dihapus atau konfirmasi akhir?

## Answer

### Penetapan awal

- Masa Tunggu Penghapusan default adalah 30 hari kalender. Provider Admin dapat menetapkan override persisten per Tenant dalam rentang 1–365 hari; override menjadi nilai awal formulir, sedangkan Tenant tanpa override menggunakan default 30 hari.
- Provider Admin wajib mengonfirmasi atau mengganti jumlah hari ketika menyetujui pengajuan Penutupan Tenant atau memulai Penutupan Tenant secara langsung. Jadwal awal tidak boleh nol hari.
- Ketika Tenant benar-benar ditutup, Kasus Penutupan Tenant menyimpan snapshot waktu penutupan, jumlah hari yang dipilih, zona waktu Tenant, tenggat absolut, dan aktor yang menetapkannya. Perubahan default global, override Tenant, atau zona waktu Tenant setelah itu tidak mengubah kasus berjalan.
- Masa tunggu dihitung sebagai hari kalender pada zona waktu snapshot dan jatuh pada jam lokal yang sama dengan waktu penutupan. Timestamp absolut adalah sumber kebenaran; keterlambatan worker tidak menggeser tenggat.

### Perubahan tenggat

- Provider Admin dapat mengubah tenggat pada `closed_waiting_deletion`, `pending_reopening_review`, atau `ready_for_deletion`. Tenggat baru tidak boleh berada di masa lalu, tetapi boleh ditetapkan ke waktu saat ini.
- Memperpendek tenggat memerlukan autentikasi ulang. Setiap perubahan memerlukan alasan, audit, dan pemberitahuan kepada seluruh School Admin aktif.
- Tenggat yang dipindahkan ke waktu saat ini membuat kasus segera dihitung ulang sebagai `ready_for_deletion`, kecuali kasus sedang `pending_reopening_review`.
- Tenggat yang dipindahkan ke masa depan dari `ready_for_deletion` mengembalikan kasus ke `closed_waiting_deletion`. Perubahan tenggat tidak tersedia mulai `deletion_in_progress` maupun pada status setelahnya.

### Kesiapan dan blocker

- Tercapainya tenggat memindahkan `closed_waiting_deletion` ke `ready_for_deletion` walaupun ekspor masih aktif. Ekspor aktif memblokir konfirmasi akhir dan dimulainya Penghapusan Tenant, bukan tercapainya kesiapan berdasarkan waktu.
- `pending_reopening_review` tetap menjadi status kasus ketika tenggat tercapai. Jika permintaan ditolak, kasus kembali ke `closed_waiting_deletion` bila tenggat belum lewat atau langsung ke `ready_for_deletion` bila tenggat telah lewat.
- Konfirmasi akhir hanya dapat dilakukan dari `ready_for_deletion` ketika Tenant masih `closed`, tidak ada permintaan Pembukaan Kembali yang belum diputuskan, tidak ada ekspor aktif, tidak ada eksekusi penghapusan lain, Provider Admin masih berwenang dan telah melakukan autentikasi ulang, serta konfirmasi eksplisit identitas Tenant telah diberikan.
- Seluruh syarat dan blocker diperiksa ulang secara atomik ketika konfirmasi dikirim. Perubahan tenggat atau blocker setelah halaman dibuka menggagalkan tindakan dengan alasan spesifik.
- Tidak ada hold penghapusan terpisah. Provider Admin menunda penghapusan dengan memindahkan tenggat ke masa depan.
- Definisi status ekspor yang aktif atau final dan batas waktu permintaan ekspor ditetapkan oleh tiket kontrak ekspor data.
