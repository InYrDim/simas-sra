Type: task
Status: resolved

## Question

Bagaimana keputusan alur Pengajuan SIMAS diterjemahkan menjadi rancangan schema, state transition, transaksi approval, kredensial sementara School Admin, penyelesaian onboarding Tenant, dan permulaan trial yang aman serta kompatibel dengan Better Auth saat ini?

## Answer

Modelkan **Pengajuan SIMAS**, **Penyediaan Tenant**, aktivasi School Admin, dan **Onboarding Tenant** sebagai lifecycle yang saling terkait tetapi terpisah. Status tidak boleh diturunkan dari keberadaan tanggal secara ad hoc; command server mengubah state dan tanggal terkait dalam transaksi, sedangkan query memproyeksikan label UI dari state tersebut.

### Schema aplikasi

Tambahkan `simas_application` sebagai rekaman pengajuan immutable:

- `id` UUID primary key.
- data asli form: `school_name`, `npsn`, `education_level`, `address`, `contact_name`, `contact_position`, `contact_email`, `contact_whatsapp`, dan `needs_note` nullable;
- `status`: `pending | approved | rejected`, default `pending`;
- `submitted_at`, `decided_at` nullable, `decided_by_provider_admin_id` nullable FK ke `provider_admin.user_id`, dan `rejection_reason` nullable;
- `approved_tenant_id` nullable, unique, FK ke `tenant.id`.

Normalisasi NPSN, email, WhatsApp, dan whitespace saat command submit, lalu simpan nilai kanonis yang benar-benar diajukan. Jangan mengubah row setelah submit selain kolom keputusan. Database/MySQL tidak perlu dipaksa mengekspresikan seluruh state machine dengan enum saja; service dan test wajib menjaga invariant berikut: `pending` tidak memiliki data keputusan, `approved` memiliki decision metadata dan `approved_tenant_id` tetapi tanpa alasan penolakan, sedangkan `rejected` memiliki decision metadata dan alasan non-kosong tetapi tanpa Tenant.

Perluas `tenant` dengan:

- `npsn` kanonis, non-null dan unique;
- `source_application_id` non-null dan unique, FK ke `simas_application.id`;
- `approved_at` non-null;
- `onboarding_completed_at`, `trial_started_at`, dan `trial_ends_at`, ketiganya nullable.

Relasi application–Tenant sengaja satu-ke-satu. Unique `tenant.npsn`, `tenant.domain`, `tenant.source_application_id`, dan `user.email` adalah benteng terakhir terhadap dua approval konkuren. Pengajuan pending/rejected dengan NPSN atau email sama tetap boleh dicatat agar konflik dapat ditampilkan dan sekolah dapat mengajukan ulang setelah penolakan; konflik wajib diperiksa ulang pada approval, bukan hanya saat submit.

Tambahkan sumber role Tenant nyata pada `user`, misalnya `tenant_role` nullable yang didaftarkan sebagai Better Auth `additionalFields`. Nilai untuk admin pertama adalah identifier kanonis `school-admin`; Provider Admin tetap `tenant_id = NULL`, `tenant_role = NULL`, dan grant-nya tetap berasal dari `provider_admin`. Jika implementasi memilih tabel membership kelak, invariant yang sama berlaku dan keputusan ini tidak membenarkan pencampuran role Provider ke role Tenant.

Tambahkan `school_admin_activation` untuk state aktivasi yang bukan milik schema inti Better Auth:

- `user_id` primary key/FK cascade ke `user.id`;
- `tenant_id` non-null/FK ke `tenant.id`;
- `temporary_credential_issued_at` non-null;
- `first_authenticated_at` nullable;
- `password_change_required` boolean non-null default `true`;
- `password_changed_at` nullable.

Satu row ini hanya untuk School Admin pertama yang dibuat saat approval. Credential account tetap berada di tabel Better Auth `account`; jangan simpan hash kedua atau plaintext di tabel aplikasi.

### State transition

Pengajuan hanya memiliki dua transisi terminal:

- `pending -> approved` melalui `approveApplication`;
- `pending -> rejected` melalui `rejectApplication(reason)`.

`approved` dan `rejected` read-only. Tidak ada reopen, edit, undo, atau perubahan keputusan. Retry command approval pada row yang sudah `approved` mengembalikan hasil `already-approved` dan Tenant yang sama tanpa menerbitkan ulang plaintext kredensial; row `rejected` menghasilkan conflict. Penolakan mengunci row, menuntut alasan non-kosong, dan menulis status serta metadata keputusan secara atomik tanpa membuat Tenant/user.

Lifecycle Tenant diproyeksikan sebagai:

- **Menunggu onboarding**: `onboarding_completed_at IS NULL`;
- **Dalam trial**: onboarding selesai dan `trial_ends_at` lebih dari tujuh hari dari waktu sekarang;
- **Segera berakhir**: trial belum berakhir dan `trial_ends_at` berada dalam tujuh hari;
- **Trial berakhir**: `trial_ends_at <= now`.

Ini adalah label query/UI, bukan enum tersimpan. Sumber kebenaran trial adalah timestamp. Invariant Tenant: ketiga timestamp onboarding/trial semuanya null sebelum completion, lalu semuanya non-null; `trial_started_at = onboarding_completed_at` dan `trial_ends_at` tepat satu bulan kalender setelah waktu mulai menurut UTC. Definisikan perhitungan itu sekali di domain service agar dashboard dan command tidak berbeda.

### Transaksi approval

`approveApplication(applicationId, subdomain, providerPrincipal)` adalah satu-satunya jalan Penyediaan Tenant versi pertama dan wajib diawali guard Provider pada boundary server. Urutannya:

1. normalisasi/validasi subdomain dan buat kredensial sementara acak dengan CSPRNG (minimal 128 bit entropy); hash sebelum membuka transaction agar hashing tidak memperpanjang lock;
2. buka transaction dan baca `simas_application` dengan row lock (`SELECT ... FOR UPDATE`);
3. bila `approved`, kembalikan `already-approved` tanpa credential; bila bukan `pending`, gagal conflict;
4. verifikasi ulang konflik NPSN terhadap Tenant, subdomain terhadap Tenant, dan email terhadap `user`; jangan mengandalkan hasil conflict preview UI;
5. insert Tenant dengan timestamp trial/onboarding null;
6. insert Better Auth `user` dengan email ternormalisasi, `tenant_id`, `tenant_role = school-admin`, dan `email_verified = true` karena kanal resmi Provider menjadi proses verifikasi operasional versi pertama;
7. insert Better Auth credential `account` dengan `provider_id = credential`, `account_id = user.id`, dan hash kredensial;
8. insert `school_admin_activation`, lalu update pengajuan menjadi `approved` beserta decision metadata dan Tenant id;
9. commit, baru kemudian kembalikan plaintext credential sekali kepada caller.

Gunakan ID yang dibuat aplikasi untuk seluruh insert dan petakan duplicate-key menjadi conflict domain yang aman. Jangan melakukan pre-check di luar transaction sebagai dasar keputusan. Jika insert atau update mana pun gagal, seluruh Tenant, user, account, activation, dan keputusan pengajuan rollback. Response/redirect hanya dilakukan setelah commit.

Better Auth 1.6.23 saat ini belum mengaktifkan `emailAndPassword`, dan kode lama hanya membuat `user` tanpa credential `account`, sehingga user tersebut tidak dapat login. Aktifkan `emailAndPassword.enabled`. Untuk atomicity, jangan memanggil `auth.api.signUpEmail` dari dalam approval: endpoint itu mengelola write/session sendiri dan tidak dapat diikutkan ke transaction Drizzle milik command. Gunakan password hasher Better Auth yang sama (`better-auth/crypto` menyediakan default `hashPassword`) dan bentuk credential account yang sama dengan sign-up Better Auth (`providerId/accountId/password`). Jika konfigurasi hash dikustomisasi, approval dan `betterAuth()` harus menerima implementasi hash/verify bersama dari satu modul; tambahkan integration test login agar schema/API internal yang berubah saat upgrade Better Auth terdeteksi.

Matikan self-service sign-up untuk pembentukan School Admin/Tenant. Pembuatan identitas School Admin pertama hanya terjadi melalui approval. `email_verified = true` tidak menghapus kewajiban mengganti kredensial sementara.

### Kredensial sementara dan login pertama

Plaintext hanya hidup di memori command dan response sukses pertama: jangan simpan, log, masukkan URL, analytics, error monitoring, atau resolution data. UI harus menandai hasil sebagai sekali tampil dan tidak memiliki endpoint “lihat kembali”. Bila response hilang, Provider menggunakan command **reset kredensial sementara**, bukan membaca credential lama.

Reset hanya diizinkan ketika `first_authenticated_at IS NULL` dan `password_change_required = true`. Command mengunci activation row, menghasilkan secret dan hash baru, mengganti password pada credential account, memperbarui `temporary_credential_issued_at`, serta mencabut semua sesi user dalam satu transaction; plaintext kembali hanya setelah commit. Setelah autentikasi pertama tercatat, Provider UI dan server menolak reset ini dan mengarahkan School Admin ke alur reset-password Better Auth biasa.

Catat `first_authenticated_at` melalui hook server setelah sign-in email/password sukses, hanya untuk user yang memiliki activation row. Buat operasi idempoten (`set if null`). Untuk menutup race reset-versus-login, reset selalu mencabut sesi dan tenant guard memuat activation dari database pada setiap request; sesi yang dibuat dengan credential lama tidak boleh lolos setelah credential diterbitkan ulang.

Selama `password_change_required = true`, tenant guard hanya mengizinkan halaman/action ganti password dan sign-out; seluruh fitur serta completion onboarding ditolak server, bukan sekadar disembunyikan. Alur ganti password memverifikasi password lama melalui Better Auth, memperbarui credential menggunakan hasher Better Auth, mencabut sesi lain, lalu menandai `password_change_required = false` dan `password_changed_at` melalui service/hook yang idempoten. Jika update flag gagal setelah password berhasil berubah, login ulang tetap mengarah ke halaman ganti password dan tersedia recovery server yang memverifikasi credential baru sebelum menyelesaikan flag—jangan melemahkan guard.

### Penyelesaian onboarding dan trial

Command `completeTenantOnboarding(tenantPrincipal, payload)` hanya menerima School Admin Tenant tersebut yang sudah mengganti password. Ia memvalidasi semua data onboarding yang diwajibkan oleh rancangan onboarding, lalu dalam transaction:

1. lock Tenant berdasarkan principal tepercaya, bukan `tenantId` dari form;
2. jika `onboarding_completed_at` sudah ada, kembalikan hasil idempoten tanpa menggeser trial;
3. tulis data konfigurasi onboarding;
4. ambil satu `now` UTC dari database/service dan set `onboarding_completed_at` serta `trial_started_at` ke nilai yang sama, kemudian `trial_ends_at` satu bulan kalender setelahnya;
5. commit.

Login pertama, ganti password, menyimpan langkah parsial, approval, atau membuka situs Tenant tidak memulai trial. Retry completion tidak pernah memperpanjang trial. Mutasi onboarding dan tiga timestamp harus rollback bersama. Semua boundary mutation memeriksa sesi, `user.tenant_id`, role `school-admin`, dan kecocokan Tenant di database; domain/subdomain dan hidden navigation bukan bukti otorisasi.

### Acceptance criteria

- Dua approval konkuren atas pengajuan yang sama menghasilkan tepat satu Tenant, satu School Admin, satu credential account, dan satu keputusan.
- Dua pengajuan berbeda dengan NPSN, subdomain, atau email yang konflik tidak dapat menghasilkan dua Tenant/user; loser rollback utuh dengan conflict yang dapat ditindaklanjuti.
- Reject tanpa alasan gagal; keputusan terminal tidak dapat diedit atau dibalik.
- User hasil approval dapat login dengan credential sementara melalui Better Auth, tetapi hanya dapat mengganti password/sign-out sampai kewajiban selesai.
- Plaintext credential tidak dapat dibaca ulang; reset pra-login menggantinya, mencabut sesi, dan kembali menampilkan secret hanya sekali; reset setelah autentikasi pertama ditolak.
- Tidak ada Tenant yang memiliki hanya sebagian user/account/activation atau sebagian timestamp onboarding/trial.
- Trial tetap null setelah approval, login pertama, dan ganti password; trial dimulai tepat sekali saat completion onboarding dan retry tidak mengubah tanggalnya.
- Pengguna Tenant lain, termasuk role lain atau School Admin Tenant lain, tidak dapat menyelesaikan onboarding Tenant target.
- Integration test Better Auth membuktikan hash hasil approval diterima oleh sign-in email/password dan perubahan/reset password tetap menjaga flag aktivasi.

### Dampak pada kode saat ini

Ganti `createTenantAction` dan form `/dashboard/onboarding`; keduanya melewati Pengajuan SIMAS, memulai trial saat Penyediaan Tenant, dan membuat `user` yang tidak memiliki password. Route Provider kanonis menyediakan command submit/review/approve/reject yang baru, sementara flow registrasi auth mandiri tidak boleh membuat Tenant. Migrasi harus memperlakukan row Tenant lama sebagai data pengembangan yang perlu seed ulang atau migrasi eksplisit—jangan mengarang `source_application_id`, NPSN, atau tanggal lifecycle tanpa kebijakan data nyata.
