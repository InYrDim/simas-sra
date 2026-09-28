# Tetapkan ruang lingkup Penjadwalan dan model sesi Absensi Kelas

Type: grilling
Status: resolved
Blocked by: None — diputuskan langsung oleh user saat sesi charting

## Question

Apa arti "absensi kelas mengikuti penjadwalan", dan seberapa jauh perubahannya: apakah menu
Penjadwalan diisi jadwal pelajaran mingguan, apakah Jadwal Sekolah yang sudah ada dipindahkan,
dan satu sesi Absensi Kelas berlaku untuk apa?

## Answer

Diputuskan user (26 September 2026):

1. **Ruang lingkup** — menu Penjadwalan diisi fitur **Jadwal Mengajar**: jadwal mingguan per
   Rombongan Belajar berisi hari, jam, Mata Pelajaran, dan Guru. Memindahkan pengaturan
   Jadwal Sekolah yang sudah ada bukan bagian dari jawaban ini dan punya tiket tersendiri.
2. **Model sesi** — sesi Absensi Kelas berlaku **per pelajaran**, terikat pada Rombongan
   Belajar + Mata Pelajaran + Guru, sehingga satu hari bisa memiliki banyak sesi. Batasan
   `attendance_session` saat ini (unik per Tenant + lapisan + tanggal) harus berubah, dan
   halaman Absensi Kelas memilih pelajaran dari jadwal hari itu alih-alih satu sesi harian.
3. **Absensi Gerbang tidak berubah** — worker Jadwal Sekolah tetap berjalan seperti sekarang.

Konsekuensi yang harus dibawa ke tiket berikutnya: perubahan skema `attendance_session`,
pemilihan pelajaran di halaman Absensi Kelas, dan perlakuan data sesi Kelas lama.
