# Tentukan kontrak routing login pusat

Type: grilling
Status: resolved
Blocked by: 01

## Question

Bagaimana login dan registrasi pusat menentukan tujuan secara aman antara Provider Admin, Pemohon, dan School Admin, termasuk callback kembali ke `/apply` dan penanganan URL tujuan yang tidak tepercaya?

## Answer

Login dan registrasi pusat menggunakan routing berbasis identitas yang dihitung server. Provider Admin diarahkan ke `/provider`; Pemohon dan School Admin hasil promosi Pemohon diarahkan ke `/apply`; anggota Tenant lain diarahkan ke `/{domain}/dashboard`. Registrasi publik selalu menghasilkan Pemohon. User dengan session aktif yang membuka `/login` atau `/register` langsung diarahkan menurut jalur identitasnya dan harus logout sebelum masuk sebagai akun lain.

Pengunjung anonim tetap dapat membuka pengantar `/apply`, lalu memilih `/login?intent=apply` atau `/register?intent=apply`. `intent` adalah enum internal yang hanya mempertahankan konteks perjalanan, bukan URL tujuan dan bukan bukti otorisasi. Untuk kontrak ini hanya `apply` yang dikenali. Setelah autentikasi, identitas selalu mengalahkan intent: Provider Admin tetap menuju `/provider` dan anggota Tenant non-Pemohon tetap menuju Tenant-nya.

Login dan registrasi pusat tidak menerima URL callback bebas. Parameter absolut, protocol-relative, encoded, path lain, atau intent yang tidak dikenal diabaikan tanpa dipantulkan ke UI maupun redirect; login tetap diproses dan destinasi default dihitung dari identitas. Percobaan invalid dicatat dalam log keamanan terstruktur. Validasi tidak menggunakan allowlist berbasis awalan path.

User yang tidak memiliki jalur identitas, memiliki beberapa jalur sekaligus, atau merujuk Tenant/domain yang tidak tersedia dianggap melanggar invariant. Sistem tidak menebak fallback ke `/apply`, tetapi mengarahkannya ke `/access-error` yang hanya menyediakan penjelasan aman, kontak Provider, dan logout; alasan teknis dicatat untuk investigasi.

Batas entry point saat session tidak tersedia adalah: `/apply` menuju `/login?intent=apply`, `/provider` menuju `/login`, dan area `/{domain}/...` menuju `/{domain}/login`. Login Tenant hanya dapat kembali ke area pada domain Tenant yang sama dan tidak menerima callback menuju Tenant lain, `/apply`, atau `/provider`. Session yang valid tetapi tidak berwenang tidak diperlakukan sebagai anonim; user diarahkan ke destinasi sah berdasarkan identitas atau `/access-error` jika identitasnya invalid.

Approval mencabut seluruh sesi Pemohon yang dipromosikan, sehingga School Admin hasil promosi wajib login ulang agar identitas barunya dimuat. Setelah login, domain selalu diambil server dari relasi Tenant milik user, dan `/apply` hanya menampilkan tautan Tenant hasil perhitungan server. School Admin boleh memakai `/{domain}/login` sebagai jalur masuk langsung, tetapi permintaan ke domain lain tidak memberi akses dan dikembalikan ke Tenant miliknya atau `/access-error`. Batas rinci entry point Tenant ditetapkan dalam [Tetapkan batas login khusus Tenant](05-tetapkan-batas-login-khusus-tenant.md).
