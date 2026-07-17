Type: prototype
Status: resolved

## Question

Bagaimana desain *User Interface* (UI) untuk Autentikasi (Halaman Login, Register, Lupa Password) yang estetik dan satu tema dengan desain sistem?

## Answer

Menggunakan desain **Split-Screen** modern: Kolom kiri dikhususkan untuk visual branding (*indigo/blue gradients*, efek glow kaca, ilustrasi pahlawan pendidikan), dan kolom kanan untuk form autentikasi murni dengan latar putih bersih tanpa efek kartu. Di mode mobile, grafis disembunyikan agar UI tetap fungsional dan terfokus. Implementasi dilakukan di Route Group `(auth)/layout.tsx`.
