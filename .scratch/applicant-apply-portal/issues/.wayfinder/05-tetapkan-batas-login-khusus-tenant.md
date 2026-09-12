# Tetapkan batas login khusus Tenant

Type: prototype
Status: resolved
Blocked by: 03, 04

## Question

Bagaimana `/{domain}/login` menemukan identitas Tenant, membatasi autentikasi hanya untuk anggota Tenant tersebut, dan mengarahkan School Admin maupun role Tenant lain tanpa mencampurkan portal Pemohon atau Provider?

## Answer

`/{domain}/login` menyelesaikan konteks Tenant melalui kecocokan tepat `{domain}` di server sebelum menampilkan form autentikasi. Domain yang tidak cocok dengan Tenant menampilkan “Tenant tidak ditemukan” tanpa form, tanpa Tenant default atau pencarian berdasarkan nama sekolah; halaman tersebut boleh menyediakan tautan eksplisit ke `/login`.

Kredensial mengautentikasi identitas `user` global, sedangkan relasi user–Tenant yang dihitung server menentukan otorisasi. `{domain}` yang diminta bukan bukti keanggotaan. Anggota yang login melalui Tenant miliknya diarahkan ke `/{domain}/dashboard`; seluruh role Tenant memakai landing page yang sama, lalu menu, halaman, dan tindakan dibatasi berdasarkan role. Anggota yang login melalui domain Tenant lain tidak memperoleh akses ke Tenant tersebut dan diarahkan ke dashboard Tenant miliknya.

Pemohon atau Provider Admin dengan kredensial valid yang masuk melalui halaman login Tenant tetap diautentikasi, tetapi diarahkan ke portal sahnya masing-masing, yaitu `/apply` atau `/provider`. Identitas yang tidak memiliki tepat satu jalur sah diarahkan ke `/access-error`. Dengan demikian, entry point Tenant tidak mengubah jalur identitas dan tidak mencampurkan kewenangan antar-portal.

Login Tenant boleh menerima tujuan lanjutan berupa path relatif dalam Tenant yang sama. Server hanya menerima path yang diawali tepat dengan `/{domain}/`, kemudian tetap memeriksa otorisasi halaman setelah autentikasi. URL absolut, protocol-relative, encoded bypass, path Tenant lain, `/apply`, dan `/provider` diabaikan; fallback selalu `/{domain}/dashboard` milik user.

Approval mencabut seluruh sesi Pemohon yang dipromosikan. School Admin hasil promosi wajib login ulang agar identitas barunya dimuat, baik melalui `/{domain}/login` maupun login pusat; tidak ada perpindahan ke Tenant memakai sesi lama.
