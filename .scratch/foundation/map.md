Status: open
Labels: wayfinder:map

## Destination

Fondasi Auth & Shell Aplikasi (Landing Page, Alur Auth UI, Layout Dashboard, dan basis RBAC) yang siap digunakan untuk menampung modul MVP selanjutnya.

## Notes

- Tech Stack: Next.js (App Router), Drizzle, Tailwind/CSS. Database dan ORM sudah terkonfigurasi.
- **Eksekusi di Peta**: Upaya ini mengizinkan eksekusi langsung (pembuatan UI/logika) sebagai resolusi tiket, bukan sekadar keputusan konseptual.
- Estetika UI wajib premium, modern, dan responsif sesuai standar aplikasi web masa kini.

## Decisions so far

- [Bagaimana desain dan implementasi Landing Page publik...](./issues/01-landing-page.md) — Menggunakan implementasi yang sudah ada di `app/page.tsx` (desain modern dengan efek glow & fitur card).
- [Bagaimana desain UI untuk Autentikasi (Login)...](./issues/02-auth-ui.md) — Ditetapkan desain Split-Screen; kiri visual branding dengan gradient & glassmorphism, kanan form autentikasi bersih.
- [Bagaimana layout *Shell/Dashboard* utama (Sidebar, Header, Navigasi) diatur...](./issues/03-dashboard-layout.md) — Menggunakan Route Group `(authenticated)` agar semua halaman internal mendapat layout Sidebar tanpa prefix `/dashboard`.
- [Bagaimana konfigurasi menu dan UI detail dari *App Sidebar*...](./issues/04-sidebar-menus.md) — Ditetapkan menu dinamis berdasarkan 5 role, diuji dengan Role Switcher di header.
- [Membuat halaman *placeholder* (stub) untuk setiap menu di Sidebar...](./issues/05-placeholders.md) — Dibuat halaman sementara untuk mencegah 404 saat bernavigasi.

## Not yet specified

- Mekanisme perlindungan rute (*route protection*) spesifik untuk masing-masing dari 6 role (Superadmin, Pimpinan, Staff, Guru, Siswa, Guest).
- Integrasi logika state form dengan library Auth (NextAuth/sejenisnya) dan *database*.
- Halaman Profil Pengguna (*User Profile*).

## Out of scope

- Modul Data Siswa (CRUD Siswa).
- Modul Penilaian Akademik (Komponen Nilai, Rapor).
