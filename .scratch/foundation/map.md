Status: open
Labels: wayfinder:map

## Destination

Fondasi Auth & Shell Aplikasi (Landing Page, Alur Auth UI, Layout Dashboard, dan basis RBAC) yang siap digunakan untuk menampung modul MVP selanjutnya.

## Notes

- Tech Stack: Next.js (App Router), Drizzle, Tailwind/CSS. Database dan ORM sudah terkonfigurasi.
- **Eksekusi di Peta**: Upaya ini mengizinkan eksekusi langsung (pembuatan UI/logika) sebagai resolusi tiket, bukan sekadar keputusan konseptual.
- Estetika UI wajib premium, modern, dan responsif sesuai standar aplikasi web masa kini.

## Decisions so far


## Not yet specified

- Mekanisme perlindungan rute (*route protection*) spesifik untuk masing-masing dari 6 role (Superadmin, Pimpinan, Staff, Guru, Siswa, Guest).
- Integrasi logika state form dengan library Auth (NextAuth/sejenisnya) dan *database*.
- Halaman Profil Pengguna (*User Profile*).

## Out of scope

- Modul Data Siswa (CRUD Siswa).
- Modul Penilaian Akademik (Komponen Nilai, Rapor).
