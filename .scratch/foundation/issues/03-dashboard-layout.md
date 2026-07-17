Type: prototype
Status: resolved

## Question

Bagaimana layout *Shell/Dashboard* utama (Sidebar, Header, Navigasi) diatur agar responsif dan bisa beradaptasi secara dinamis menyembunyikan/menampilkan menu berdasarkan *role* pengguna yang sedang login?

## Answer

Struktur layout utama diputuskan menggunakan Route Group `(authenticated)` di Next.js. Sidebar dan layout internal (Header, Navigasi) yang sebelumnya berada di `app/dashboard/layout.tsx` telah dipindahkan ke `app/(authenticated)/layout.tsx`. Dengan pola ini, semua halaman yang berada di dalam Route Group tersebut (misal `/siswa`, `/pengaturan`) akan secara otomatis mendapatkan layout Sidebar tanpa perlu menambahkan *prefix* `/dashboard` di URL-nya. Sementara halaman publik (Landing Page & Login) tetap bebas dari Sidebar.
