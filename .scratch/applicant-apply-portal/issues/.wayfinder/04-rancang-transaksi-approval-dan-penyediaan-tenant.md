# Rancang transaksi approval dan penyediaan Tenant

Type: grilling
Status: resolved
Blocked by: 01

## Question

Bagaimana satu operasi atomik memvalidasi domain, menyediakan Tenant, mempromosikan Pemohon menjadi School Admin, dan menandai Pengajuan SIMAS approved tanpa menghasilkan state parsial ketika terjadi kegagalan atau approval bersamaan?

## Answer

Approval hanya dapat dimulai untuk Pengajuan SIMAS `pending`. Di dalam satu transaksi database, operasi mengunci dan memvalidasi ulang Pengajuan, Pemohon pemiliknya, ikatan NPSN, domain final pilihan Provider Admin, serta ketiadaan Tenant untuk NPSN tersebut. Tenant dibentuk menggunakan nama sekolah dan NPSN dari snapshot Pengajuan, domain final dari Provider Admin, dan referensi immutable ke Pengajuan sumber.

User pemilik Pengajuan dipromosikan menjadi School Admin Tenant yang baru; email kontak pada snapshot tidak menentukan akun yang dipromosikan. Identitas autentikasi dan password user dipertahankan tanpa menerbitkan Kredensial sementara. Seluruh sesi aktif user dicabut agar perubahan identitas berlaku melalui login baru. Transaksi juga mencatat Provider Admin pengambil keputusan dan waktu approval, menghubungkan Pengajuan secara immutable ke Tenant, lalu mengubah status Pengajuan menjadi `approved`. Seluruh perubahan tersebut harus berhasil atau gagal bersama.

Jika domain sudah digunakan, seluruh transaksi dibatalkan, Pengajuan tetap `pending`, dan Provider Admin dapat memilih domain lain. Jika NPSN sudah memiliki Tenant, transaksi dibatalkan sebagai konflik data yang memerlukan pemeriksaan, bukan retry biasa. Pada approval bersamaan, transaksi pertama menjadi pemenang. Permintaan berikutnya dianggap berhasil secara idempoten hanya bila meminta hasil yang identik, terutama domain yang sama; hasil berbeda ditolak sebagai konflik dan tidak boleh membuat data tambahan.

Approval bersifat final: status, Tenant hasil penyediaan, dan relasi sumbernya tidak dibalik melalui operasi approval. Koreksi, penonaktifan, pemindahan admin, atau pembatalan Tenant memerlukan operasi administratif terpisah dengan audit sendiri. Email dan notifikasi bukan bagian dari keberhasilan transaksi; catatan/outbox dibuat dalam transaksi dan pengiriman dilakukan setelah commit agar kegagalan dapat dicoba ulang tanpa membatalkan approval.
