Type: task
Status: resolved
Blocked by: 

## Question

Buat struktur *route* dan UI dasar (tabel, form kosong, dan *dashboard* awal) untuk modul-modul MVP:
- **Manajemen User**
- **Master Data** (Siswa, Guru, Staf, Mata Pelajaran, Organisasi)
- **Penjadwalan** (Jadwal Mengajar, Events)
- **Persuratan**
- **E-Library**
- **Absensi**

Target dari tiket ini adalah membuat wujud visualnya di aplikasi (memanfaatkan komponen yang ada) agar kita bisa melakukan *review* navigasi dan *layout*-nya secara keseluruhan sebelum masuk ke detail interaksi masing-masing layar.

## Answer

Rute dan UI *placeholder* dasar telah dibuat dan dikonfigurasikan pada navigasi *sidebar* (`config.ts`).
1. Rute lama (seperti `/akademik` dan `/siswa`) telah dihapus.
2. Struktur rute baru telah di-_generate_ di dalam `app/(authenticated)` sesuai dengan spesifikasi MVP.
3. *Role* `guest` juga telah ditambahkan ke beberapa menu yang memungkinkan akses baca/publik (seperti Dasbor, E-Library, Events).
