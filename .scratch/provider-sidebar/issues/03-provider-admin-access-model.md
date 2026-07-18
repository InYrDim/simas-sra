Type: task
Status: resolved

## Question

Bagaimana ADR identitas Provider Admin diterjemahkan menjadi rancangan schema `provider_admin`, provisioning idempotent, dan guard server untuk `/provider/*` yang kompatibel dengan integrasi Better Auth saat ini?

## Answer

Gunakan identitas Better Auth yang sudah ada sebagai sumber autentikasi dan jadikan baris `provider_admin` sebagai satu-satunya grant otorisasi Provider. Jangan tambahkan role Provider ke `user` dan jangan masukkan `providerAdmin` ke union role Tenant.

### Schema

Tambahkan tabel Drizzle berikut ke schema yang sudah dipindai oleh `drizzle.config.ts`:

- `provider_admin.user_id`: `varchar(36)`, primary key, foreign key ke `user.id`, `onDelete: cascade`.
- `provider_admin.created_at`: timestamp non-null dengan default waktu database.

Primary key pada `user_id` sekaligus menjamin relasi satu-ke-satu dan menyediakan indeks lookup guard; tidak perlu kolom `id`, `tenant_id`, `role`, atau unique index tambahan. Definisikan relasi Drizzle satu-ke-satu dari `user` ke `provider_admin` agar model dapat di-query secara konsisten, tetapi guard tidak boleh bergantung pada data relasi yang dikirim oleh klien.

Constraint lintas tabel `provider_admin.user_id -> user.tenant_id IS NULL` tidak dapat diekspresikan sebagai foreign key MySQL biasa. Karena itu invariant Provider Admin adalah gabungan dua syarat yang selalu diverifikasi server:

1. baris `provider_admin` ada untuk `session.user.id`; dan
2. `user.tenant_id IS NULL` pada database saat pemeriksaan dilakukan.

Migrasi hanya membuat tabel dan constraint tersebut. Migrasi tidak boleh menebak Provider Admin dari `role`, email, atau pengguna tanpa Tenant.

### Provisioning idempotent

Pisahkan pembuatan identitas dari pemberian akses:

- Better Auth tetap memiliki lifecycle `user`, `account`, dan credential.
- Operasi internal `provisionProviderAdmin(userId)` hanya memberikan grant Provider kepada identitas Better Auth yang sudah ada.
- Jalankan operasi dalam transaction. Lock/read pengguna berdasarkan primary key, gagal jika tidak ada, gagal dengan konflik domain jika `tenant_id` tidak null, lalu insert `provider_admin` dengan semantics no-op/on-duplicate untuk primary key yang sama.
- Hasil eksplisit: `created` ketika grant baru dibuat dan `already-provisioned` ketika grant identik sudah ada. Pemanggilan ulang tidak membuat user atau grant kedua.
- Jika entry point operator menerima email, normalisasi email lalu resolve melalui unique `user.email`; setelah itu algoritme tetap bekerja dengan `user.id`. Email bukan foreign key atau identitas grant.
- Jangan otomatis mengosongkan `tenant_id`. Pengguna Tenant yang hendak menjadi Provider Admin harus melalui migrasi identitas yang disengaja atau memakai identitas Provider terpisah; provisioning biasa harus menolak kasus tersebut.
- Deprovisioning menghapus baris `provider_admin`, bukan `user`. Sesi Better Auth boleh tetap hidup tetapi kehilangan akses Provider pada request berikutnya karena guard membaca database lagi.

Untuk bootstrap awal, sediakan script/operator command yang menerima `userId` atau email yang sudah terdaftar dan memanggil operasi yang sama. Secret/password tidak menjadi argumen atau disimpan oleh script provisioning ini.

### Guard server

Buat modul server-only terpusat, misalnya `lib/provider-access.ts`, dengan dua lapisan:

1. `getProviderAccess()` mengambil sesi melalui API server Better Auth yang terpasang (`auth.api.getSession({ headers: await headers() })`), lalu melakukan query database dengan inner join `provider_admin` dan `user`, dibatasi oleh `session.user.id` dan `user.tenant_id IS NULL`. Kembalikan hasil terdiskriminasi `unauthenticated | forbidden | authorized`; hasil authorized hanya mengekspos principal minimum seperti `userId`, `name`, dan `email`.
2. Adapter sesuai boundary mengubah hasil tersebut menjadi perilaku transport: halaman/layout mengarahkan `unauthenticated` ke halaman sign-in dan menampilkan halaman akses ditolak untuk `forbidden`; Route Handler mengembalikan 401/403; Server Action melempar error otorisasi yang terkontrol sebelum membaca input atau melakukan mutation.

Guard wajib dipanggil pada:

- layout server teratas untuk seluruh route group kanonis `/provider/*`, agar UI tidak dirender untuk pihak yang tidak berhak;
- setiap Server Action, Route Handler, dan fungsi DAL yang membaca atau mengubah data Provider, karena proteksi layout bukan security boundary dan action dapat dipanggil langsung.

`proxy.ts` bukan tempat pemeriksaan grant `provider_admin`: dokumentasi Next.js 16.2 merekomendasikan pemeriksaan database aman di DAL/dekat sumber data dan hanya pemeriksaan cookie optimistis di Proxy. Proxy yang ada tetap menangani routing host; bila kelak ditambah prefilter sesi, guard server di atas tetap wajib. Route `/provider/*` juga harus dikecualikan dari rewrite subdomain Tenant agar path Provider tidak berubah menjadi `/[domain]/provider/*`.

Jangan mengandalkan `session.user.tenantId`, prop sidebar, role `superadmin`, hidden navigation, atau cache lintas request sebagai bukti akses. `tenantId` dalam sesi boleh dipakai untuk tampilan, tetapi keputusan Provider membaca `user.tenant_id` dan `provider_admin` dari database. Memoisasi dengan React `cache()` hanya boleh berlaku selama satu render/request, sehingga deprovisioning efektif pada request berikutnya.

### Acceptance criteria keamanan

- Tanpa sesi, request halaman Provider diarahkan ke sign-in dan endpoint mengembalikan 401.
- Sesi pengguna Tenant, termasuk School Admin/`superadmin`, ditolak 403 meskipun mengetahui URL atau memanggil action secara langsung.
- Sesi user tanpa Tenant tetapi tanpa baris `provider_admin` tetap ditolak 403.
- Sesi user dengan baris `provider_admin` tetapi `tenant_id` non-null tetap ditolak 403; state invalid ini juga terdeteksi oleh pemeriksaan/integrity test.
- Provider Admin valid dapat mengakses `/provider/*` dan menjalankan action Provider.
- Provisioning dua kali menghasilkan tepat satu baris dan hasil kedua `already-provisioned`.
- Provisioning user yang tidak ada atau user Tenant gagal tanpa perubahan parsial.
- Menghapus grant memblokir sesi yang sama pada request berikutnya.
- Test action membuktikan pemanggilan langsung tidak melewati guard layout.

### Dampak pada kode saat ini

`app/(provider)/dashboard/actions.ts` saat ini melakukan mutation tanpa autentikasi atau otorisasi; saat route dipindah ke `/provider/*`, action tersebut harus memanggil guard sebelum validasi form dan transaction. Route lama `/dashboard` diganti langsung sesuai keputusan map dan tidak menjadi alias atau redirect. Schema auth yang dihasilkan Better Auth harus tetap mempertahankan additional field `tenantId`; tabel `provider_admin` adalah schema aplikasi yang dipelihara melalui migrasi Drizzle, bukan field tambahan Better Auth.
