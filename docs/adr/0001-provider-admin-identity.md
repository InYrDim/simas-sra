# Model Provider Admin as a linked identity

Provider Admin menggunakan autentikasi Better Auth yang sama dengan pengguna Tenant, tetapi otorisasinya ditandai oleh tabel `provider_admin` yang berelasi satu-ke-satu dengan tabel `user`. Pendekatan ini menjaga batas keamanan Provider/Tenant tanpa menduplikasi tabel identitas, akun, dan sesi; Provider Admin tidak memiliki `tenant_id`, sedangkan keberadaan baris `provider_admin` menjadi syarat akses ke area Provider.

## Considered Options

- Tabel autentikasi Provider yang sepenuhnya terpisah ditolak karena menduplikasi pengelolaan identitas, akun, sesi, dan alur autentikasi.
- Role string pada tabel `user` ditolak sebagai satu-satunya batas keamanan karena mudah tercampur dengan role internal Tenant.

## Consequences

- Schema memerlukan tabel `provider_admin` dengan `user_id` sebagai primary key sekaligus foreign key ke `user.id`.
- Otorisasi `/provider/*` harus memverifikasi sesi pengguna dan keberadaan profil `provider_admin` pada server.
- Provider Admin harus memiliki `user.tenant_id = NULL`; pengguna Tenant tidak memperoleh akses Provider hanya dari role Tenant-nya.
