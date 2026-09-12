# Portal Pemohon dan Akses Tenant

Label: wayfinder:map

## Destination

Menghasilkan rencana implementasi lengkap untuk portal `/apply` berbasis akun Pemohon: registrasi dan login publik, kepemilikan serta status Pengajuan SIMAS, promosi atomik menjadi School Admin saat approval, akses Tenant, routing Provider Admin, dan login khusus pengguna pada domain Tenant.

## Notes

- Gunakan istilah domain dalam [`CONTEXT.md`](../../CONTEXT.md): Tenant adalah ruang kerja sekolah; pengguna sebelum approval adalah Pemohon; setelah approval akun Pemohon menjadi School Admin.
- `/apply` adalah pusat perjalanan Pemohon dan School Admin yang masuk melalui login pusat.
- Registrasi publik selalu membuat Pemohon; Provider Admin hanya dibuat melalui proses internal.
- Pengguna Tenant selain School Admin masuk melalui `/{domain}/login`; mereka tidak memakai portal `/apply`.
- Satu akun mewakili satu sekolah/NPSN. Pengajuan ulang hanya untuk akun dan sekolah yang sama setelah penolakan.
- Approval dan penyediaan Tenant harus atomik. Provider Admin menentukan domain dengan slug awal dari nama sekolah.
- Verifikasi email ditunda dan berada di luar scope map ini.
- Wayfinder ini merencanakan keputusan dan spesifikasi; implementasi berada di luar map.
- Saat menyentuh Next.js, baca dokumentasi versi lokal di `monorepo/node_modules/next/dist/docs/index.md` dan panduan App Router yang dirujuk `monorepo/AGENTS.md`.

## Decisions so far

- [Model identitas Pemohon dan kepemilikan Pengajuan SIMAS](issues/01-model-identitas-pemohon-dan-kepemilikan-pengajuan.md) — Satu identitas user menempuh jalur eksklusif; pengiriman pertama mengikat Pemohon secara unik dan permanen ke NPSN, setiap Pengajuan menyimpan pemilik serta snapshot, dan approval mempromosikan user yang sama beserta kredensialnya.
- [Tentukan kontrak routing login pusat](issues/03-tentukan-kontrak-routing-login-pusat.md) — Server merutekan berdasarkan jalur identitas; intent internal hanya mempertahankan konteks `/apply`, URL tujuan bebas ditolak, dan login pusat tetap terpisah dari entry point Tenant.
- [Rancang transaksi approval dan penyediaan Tenant](issues/04-rancang-transaksi-approval-dan-penyediaan-tenant.md) — Approval mengunci dan memvalidasi seluruh invariant, lalu secara atomik menyediakan Tenant, mempromosikan pemilik menjadi School Admin, mencabut sesi, mencatat keputusan final, dan menangani retry identik secara idempoten.
- [Tentukan state machine portal apply](issues/02-tentukan-state-machine-portal-apply.md) — `/apply` memiliki lima state berbasis identitas dan Pengajuan terakhir; riwayat tetap immutable dan tersedia setelah approval, sedangkan rejection beralasan wajib membuka pengajuan ulang langsung sebagai record baru.
- [Tetapkan invarian duplikasi dan konkurensi pengajuan](issues/07-tetapkan-invarian-duplikasi-dan-konkurensi.md) — Ikatan NPSN unik, satu pending, idempotency key, nomor percobaan, transisi final, dan urutan lock kanonis menjaga submit serta approval tetap atomik dan aman terhadap konkurensi.
- [Putuskan migrasi aktivasi School Admin](issues/06-putuskan-migrasi-aktivasi-school-admin.md) — Aktivasi Kredensial sementara menjadi record opsional dan historis khusus School Admin buatan Provider; hasil promosi Pemohon mempertahankan kata sandi tanpa activation record.
- [Tetapkan batas login khusus Tenant](issues/05-tetapkan-batas-login-khusus-tenant.md) — Domain memilih konteks Tenant tetapi relasi server menentukan akses; identitas lintas-portal diarahkan ke destinasinya, tujuan lanjut dibatasi ke Tenant yang sama, dan School Admin hasil promosi wajib login ulang.
- [Susun handoff implementasi dan validasi](issues/08-susun-handoff-implementasi-dan-validasi.md) — Handoff menetapkan cutover expand/backfill/verify/contract, batas modul dan kontrak halaman/action, urutan implementasi aman, serta matriks uji unit hingga release tanpa keputusan produk tersisa.

## Not yet specified

Tidak ada.

## Out of scope

- Verifikasi email Pemohon ditunda untuk effort berikutnya.
- UI sengketa atau pergantian Pemohon ditangani Provider secara manual.
- Registrasi publik guru, staf, siswa, dan pengguna Tenant selain Pemohon.
- Pelaksanaan implementasi fitur; destination map ini adalah rencana yang siap dieksekusi.
