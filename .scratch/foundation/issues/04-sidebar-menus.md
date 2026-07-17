Type: prototype
Status: resolved

## Question

Bagaimana konfigurasi menu dan UI detail dari *App Sidebar*? Perlu menentukan daftar menu apa saja yang muncul secara dinamis untuk masing-masing role (Superadmin, Pimpinan, Staff, Guru, Siswa) beserta navigasinya.

## Answer

Konfigurasi Sidebar diputuskan menggunakan komponen `AppSidebar` dengan menu dinamis berdasarkan 5 role dashboard (Superadmin, Pimpinan, Staff, Guru, Siswa). Menu didistribusikan sebagai berikut: Dasbor (semua), Data Siswa (staff, guru, pimpinan), Jadwal & Mapel (staff, guru, siswa, pimpinan), Penilaian & Rapor (guru, siswa, pimpinan), serta Manajemen Pengguna dan Pengaturan (superadmin). Karena library Auth belum sepenuhnya terhubung, sebuah *Role Switcher* diletakkan di Header untuk menguji perubahan layout berdasarkan simulasi state role aktif secara *real-time*.
