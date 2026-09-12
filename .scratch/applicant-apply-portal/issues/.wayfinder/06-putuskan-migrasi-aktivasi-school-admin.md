# Putuskan migrasi aktivasi School Admin

Type: grilling
Status: resolved
Blocked by: 04

## Question

Bagaimana model kredensial sementara dan `schoolAdminActivation` yang ada harus dimigrasikan atau dipensiunkan ketika akun Pemohon yang sudah memiliki kata sandi dipromosikan langsung menjadi School Admin?

## Answer

School Admin memiliki dua jalur pembentukan yang saling eksklusif. Pemohon yang dipromosikan saat approval mempertahankan kata sandinya, tidak menerima Kredensial sementara, dan tidak memiliki record aktivasi kredensial. Provider tetap dapat membuat School Admin melalui operasi administratif terpisah; hanya jalur ini yang menerbitkan Kredensial sementara dan mewajibkan pergantian kata sandi sebelum pengguna dapat memakai Tenant.

`schoolAdminActivation` diganti menjadi `temporaryCredentialActivation` agar model menyatakan fungsi record secara tepat dan tidak menyiratkan bahwa semua School Admin memerlukannya. Seluruh record lama dimigrasikan satu-banding-satu dengan mempertahankan `userId`, `tenantId`, waktu penerbitan kredensial, waktu autentikasi pertama, status kewajiban mengganti kata sandi, dan waktu pergantian kata sandi. Migrasi tidak membuat record bagi School Admin yang sebelumnya tidak memilikinya, dan transaksi approval baru tidak membuat record tersebut.

Setelah login, hanya pengguna dengan `temporaryCredentialActivation.passwordChangeRequired = true` yang diarahkan ke `/change-password`; School Admin hasil promosi langsung menuju Tenant. Reset Kredensial sementara hanya tersedia bagi akun buatan Provider yang belum berhasil melakukan autentikasi pertama. Setelah autentikasi pertama, serta untuk seluruh School Admin hasil promosi, pemulihan menggunakan alur kata sandi biasa.

Record aktivasi dipertahankan setelah pergantian kata sandi sebagai riwayat non-rahasia penerbitan Kredensial sementara. Nilai rahasia tidak disimpan pada record tersebut. UI Provider membedakan "Kata sandi akun Pemohon" dari "Kredensial sementara" dan hanya menampilkan status "Menunggu login pertama" untuk jalur Kredensial sementara.

Tidak ditambahkan kolom `schoolAdminOrigin`. Asal School Admin diturunkan dari relasi kanonis: keberadaan `temporaryCredentialActivation` menunjukkan pembuatan administratif oleh Provider, sedangkan relasi pemilik Pengajuan sumber Tenant menunjukkan promosi Pemohon. Operasi pembentukan School Admin harus menjaga kedua jalur tersebut tetap eksklusif.
