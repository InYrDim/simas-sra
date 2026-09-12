# Susun handoff implementasi dan validasi

Type: task
Status: resolved
Blocked by: 02, 03, 04, 05, 06, 07

## Question

Bagaimana seluruh keputusan diterjemahkan menjadi urutan implementasi yang aman, perubahan schema dan migrasi, kontrak halaman/action, serta matriks pengujian yang dapat diserahkan ke sesi eksekusi tanpa keputusan produk tersisa?

## Answer

Implementasi diserahkan sebagai cutover bertahap berikut. Urutan ini sengaja menempatkan invariant data dan service domain sebelum halaman agar UI tidak pernah menjadi satu-satunya penjaga aturan bisnis.

### 1. Baseline dan audit data sebelum migrasi

- Bekukan perilaku existing dengan menjalankan `pnpm test`, `pnpm typecheck`, dan `pnpm build` dari `monorepo/` sebelum perubahan.
- Tambahkan audit migrasi yang menghitung Pengajuan SIMAS tanpa pemilik, NPSN nonkanonis/duplikat, lebih dari satu `pending` per NPSN, user yang sekaligus Provider Admin dan anggota Tenant, School Admin tanpa/lebih dari satu Tenant, serta relasi approval–Tenant yang tidak konsisten.
- Migrasi tidak boleh menebak pemilik Pengajuan lama dari `contactEmail`, karena snapshot kontak bukan identitas. Jika database nonkosong mempunyai Pengajuan tanpa pemilik, deployment berhenti dengan laporan ID untuk rekonsiliasi manual Provider. Setelah semua baris dapat dipetakan secara eksplisit ke user yang benar, backfill dijalankan melalui mapping terverifikasi.
- Catat baseline jumlah `school_admin_activation`; rename berikutnya wajib mempertahankan jumlah dan seluruh timestamp satu-banding-satu.

### 2. Migrasi schema kompatibel ke depan

Ubah `monorepo/db/schema.ts` dan hasil migrasi Drizzle dengan bentuk kanonis ini:

- Tambahkan `applicant` dengan `userId` sebagai primary key/FK ke `user`. Record ini menandai Pemohon sejak registrasi, termasuk sebelum Pengajuan pertama. Pembuatan internal Provider Admin dan pengguna Tenant tidak membuat record ini.
- Tambahkan `applicant_school_binding` dengan `id`, `userId` unik, dan `canonicalNpsn` unik. Record dibuat atomik bersama Pengajuan pertama dan tidak dihapus saat rejection atau promosi.
- Tambahkan ke `simas_application`: `ownerUserId` non-null/FK `user`, `bindingId` non-null/FK binding, `attemptNumber` positif, `idempotencyKey`, dan `payloadHash`. Tambahkan unique `(bindingId, attemptNumber)` serta unique `(ownerUserId, idempotencyKey)`.
- Pertahankan kolom snapshot sekolah/kontak; `npsn` snapshot boleh menyimpan input yang sudah dipresentasikan, tetapi semua pemeriksaan identitas dan konflik memakai `applicant_school_binding.canonicalNpsn`.
- Tegakkan maksimal satu pending per binding pada MySQL dengan generated nullable column yang bernilai `bindingId` hanya saat status `pending`, lalu unique index pada generated column. Jangan mengandalkan partial index yang tidak didukung MySQL.
- Pertahankan check state keputusan dan tambahkan constraint `attemptNumber > 0`. Seluruh mutasi status harus melalui update bersyarat `WHERE status = 'pending'`; final record diperlakukan immutable. Bila kemampuan migrasi proyek mendukung trigger, lindungi juga perubahan owner, binding, attempt, snapshot, serta transisi final di database; jika tidak, batasi writer ke service transaksi tunggal dan beri integration test database untuk setiap invariant.
- Rename tabel/model `school_admin_activation` menjadi `temporary_credential_activation`, termasuk nama constraint, relation, store, command, test, dan import. Data lama dipindah satu-banding-satu; tidak ada record baru untuk Pemohon yang dipromosikan.
- Pertahankan `tenant.sourceApplicationId` dan `simas_application.approvedTenantId` sebagai relasi satu-banding-satu. Tenant hasil approval memakai NPSN kanonis binding dan snapshot nama sekolah.
- Tambahkan outbox/audit event approval bila infrastruktur belum tersedia. Pembuatan event berada dalam transaksi approval; pengiriman notifikasi berada setelah commit dan bukan syarat sukses.

Eksklusivitas lintas tabel tidak dapat dijamin oleh check constraint MySQL biasa. Semua operasi pembentukan identitas wajib memakai satu service yang mengunci `user`, lalu memastikan tepat satu jalur: record `provider_admin`, record `applicant`, atau pasangan `user.tenantId` + `user.tenantRole`. Promosi menghapus penanda `applicant` hanya setelah binding dan riwayat tetap aman, lalu mengisi keanggotaan Tenant pada user yang sama. Resolver identitas menganggap nol atau lebih dari satu jalur sebagai invariant violation, bukan fallback.

Migrasi dilakukan expand/backfill/verify/contract: tambahkan struktur nullable dan writer baru, backfill terverifikasi, jalankan audit invariant, ubah menjadi non-null/aktifkan unique constraints, pindahkan reader, lalu hapus nama/kontrak lama. Jangan deploy halaman portal baru sebelum fase verify lulus.

### 3. Bentuk modul domain dan transaksi

Pisahkan halaman dari aturan domain dengan kontrak server-only berikut:

1. **Identity resolver** memuat user beserta `provider_admin`, `applicant`, Tenant, role, dan `temporary_credential_activation`, lalu menghasilkan tepat salah satu `provider-admin`, `applicant`, `tenant-member`, atau `invalid`. Resolver ini menjadi satu sumber routing pusat, guard halaman, dan login Tenant.
2. **Apply portal query** menerima user ID dan mengembalikan union state `applicant-empty`, `applicant-pending`, `applicant-rejected`, atau `school-admin`, beserta riwayat berurut `attemptNumber`. Anonymous ditangani sebelum query. Data School Admin menyertakan domain Tenant dari relasi server, bukan input/callback.
3. **Submit application command** mewajibkan principal Pemohon dan idempotency key. Normalisasi/validasi NPSN dilakukan sebelum transaksi. Transaksi mengunci user lalu binding; untuk submit pertama membuat binding dan attempt `1`, sedangkan resubmit memvalidasi latest final `rejected` lalu memakai attempt berikutnya. Payload snapshot dan hash disimpan immutable. Retry key+hash sama mengembalikan ID lama; key sama+hash berbeda, NPSN lintas akun, existing pending, atau identity non-Pemohon menghasilkan typed conflict tanpa membocorkan pemilik.
4. **Reject command** mengunci binding lalu Pengajuan dalam urutan kanonis, mewajibkan alasan nonkosong, dan melakukan update bersyarat pending→rejected. Retry rejection identik boleh mengembalikan hasil final; keputusan berbeda/final lain menjadi conflict.
5. **Approve command** mengunci binding, Pengajuan, user, lalu record terkait. Validasi ulang status pending, owner, NPSN, domain exact/unik, ketiadaan Tenant NPSN, dan eksklusivitas identitas. Dalam satu transaksi: buat Tenant, hubungkan source application, promosikan user existing menjadi School Admin, hapus jalur Pemohon, hapus seluruh session user, tulis keputusan Provider Admin/waktu/approved Tenant, ubah pending→approved, dan tulis outbox/audit. Jangan membuat user, account password, atau activation record baru. Retry domain sama mengembalikan Tenant existing; domain/keputusan berbeda menjadi conflict.
6. **Central destination resolver** menerima identity result dan optional enum intent. Hasilnya hanya `/provider`, `/apply`, `/{domain}/dashboard`, `/change-password` untuk activation yang masih wajib, atau `/access-error` untuk invariant violation. Tidak menerima URL callback bebas.
7. **Tenant login resolver** menyelesaikan `{domain}` exact terlebih dahulu, memvalidasi optional same-Tenant relative continuation, lalu setelah autentikasi merutekan berdasarkan identity server-side. Domain URL tidak pernah menjadi bukti membership.

Refactor existing `monorepo/lib/simas-applications.ts`, `monorepo/lib/provider-applications.ts`, dan data store terkait menuju kontrak di atas sebelum mengganti caller. Existing approval yang membuat user, account, Kredensial sementara, dan `school_admin_activation` harus dihapus hanya setelah test promosi user existing hijau.

### 4. Kontrak halaman dan server action

- `GET /apply`: anonymous melihat pengantar dengan `/login?intent=apply` dan `/register?intent=apply`; Pemohon melihat salah satu empty/pending/rejected; School Admin hasil promosi melihat approval, riwayat, dan tautan Tenant server-derived. Provider Admin dan anggota Tenant lain dialihkan oleh identity resolver ke tujuan sah. Pending read-only; rejected menawarkan form record baru; approved tidak menawarkan submit.
- `submitSimasApplicationAction`: wajib session Pemohon, menerima field snapshot plus hidden idempotency key yang dibentuk per render/attempt, tidak menerima owner/NPSN binding/attempt/status dari client, dan mengembalikan discriminated state untuk validation, duplicate-NPSN-safe-message, pending conflict, idempotency conflict, atau success. Setelah sukses lakukan revalidation/redirect ke `/apply` agar state berasal dari query server.
- `GET /login` dan `GET /register`: parse hanya enum `intent=apply`; user bersesi langsung dialihkan oleh resolver. Nilai intent/URL invalid diabaikan, tidak dipantulkan, dan dicatat sebagai structured security log. Registrasi publik membuat user+account+`applicant` atomik dan tidak menerima role dari client.
- `/continue` (atau callback server ekuivalen): ganti asumsi `tenantId ? tenant : provider` dengan central destination resolver. Password-change precedence hanya berlaku bila activation record ada dan `passwordChangeRequired=true`.
- `GET /access-error`: pesan aman, kontak Provider, dan logout; detail invariant hanya di structured server log.
- `GET /{domain}/login`: bila domain tidak exact, tampilkan “Tenant tidak ditemukan” tanpa form. Bila valid, autentikasi global lalu route Pemohon ke `/apply`, Provider Admin ke `/provider`, member Tenant yang diminta ke continuation/dashboard, dan member Tenant lain ke dashboard Tenant miliknya. Continuation harus path relatif yang diawali tepat `/{domain}/`; absolute, protocol-relative, encoded bypass, cross-Tenant, `/apply`, dan `/provider` diabaikan.
- Guard area `/provider`, `/apply`, dan `/{domain}/...` membedakan anonymous dari authenticated-but-unauthorized. Anonymous memakai entry point yang diputuskan; authenticated user dialihkan ke destination sah atau `/access-error`.
- Provider detail Pengajuan tetap menampilkan snapshot immutable dan riwayat konflik yang tidak membocorkan data ke Pemohon. Approval form menerima domain final dengan slug awal hasil `suggestSubdomain`; response sukses tidak lagi mengandung atau menampilkan Kredensial sementara. Rejection tetap mewajibkan alasan.
- Rename UI Provider terkait activation menjadi “Kredensial sementara”. Status “Menunggu login pertama” dan reset hanya tampil bila activation record ada; School Admin hasil promosi ditandai memakai kata sandi akun Pemohon dan tidak menawarkan reset Kredensial sementara.

### 5. Urutan perubahan yang aman untuk sesi eksekusi

1. Tambahkan test characterization untuk flow existing dan test baru yang masih merah pada resolver identitas, portal-state union, submit idempotent, approval-promotes-existing-user, dan routing aman.
2. Buat migrasi expand, audit/backfill tool, rename activation secara kompatibel, dan test migrasi pada salinan data realistis.
3. Implementasikan identity resolver serta destination/continuation validators; pindahkan `/continue` dan guard terlebih dahulu tanpa membuka portal submit baru.
4. Implementasikan query portal dan submit transaction; ubah `/apply` dari form anonim menjadi stateful authenticated portal. Hapus writer insert langsung pada action.
5. Implementasikan reject/approve transaction baru dan data store dengan urutan lock kanonis; ubah Provider UI agar tidak membuat/menampilkan Kredensial sementara pada approval.
6. Implementasikan login Tenant exact-domain dan same-Tenant continuation; integrasikan guard semua area.
7. Jalankan fase verify schema, aktifkan non-null/unique/generated constraints, lalu contract migration dan hapus API/nama lama.
8. Jalankan seluruh matriks validasi, uji migrasi rollback pada staging, dan baru lakukan cutover. Deployment aplikasi yang membutuhkan kolom baru tidak boleh mendahului expand migration; contract migration tidak boleh mendahului seluruh reader/writer baru.

### 6. Matriks pengujian wajib

**Unit/domain**

- Normalisasi NPSN, slug, snapshot, dan validasi field.
- Identity resolver: masing-masing jalur tunggal, nol jalur, multi-jalur, Tenant/domain hilang.
- Lima state `/apply`, ordering attempt, immutable history, dan tindakan yang tersedia per state.
- Intent hanya `apply`; seluruh bentuk open redirect invalid; same-Tenant continuation valid/invalid termasuk encoding dan boundary prefix.
- Submit: first attempt, resubmit setelah rejected, larangan pending/approved/non-Pemohon, idempotent same payload, conflict changed payload, dan pesan NPSN duplicate yang tidak membocorkan pemilik.
- Reject/approve typed outcomes, alasan wajib, domain validation, retry identik, dan final-decision conflict.
- Activation: hanya record `passwordChangeRequired` menuju `/change-password`; promosi tanpa activation langsung menuju Tenant.

**Integration database dengan MySQL nyata**

- Unique user dan canonical NPSN pada binding; attempt monotonik dan unik; unique idempotency; generated unique pending.
- Dua submit bersamaan: akun sama/NPSN berbeda, akun berbeda/NPSN sama, key sama, key berbeda, serta resubmit bersamaan—tepat satu hasil sah dan tidak ada record parsial.
- Submit versus reject/approve dengan urutan lock sama tidak deadlock pada skenario terkontrol dan hanya state terkini yang commit.
- Approve versus approve: domain sama idempoten; domain berbeda conflict; tepat satu Tenant; user ID/account/password tetap; role menjadi School Admin; applicant marker hilang; binding/history tetap; seluruh session terhapus; tidak ada temporary activation.
- Kegagalan pada setiap langkah approval merollback Tenant, promosi, keputusan, session deletion, dan outbox bersama-sama.
- Rejection hanya pending→rejected, alasan tersimpan, final record tidak dapat ditimpa.
- Rename activation mempertahankan seluruh row/timestamp dan flow akun Provider-created tetap berfungsi.

**Route/action integration**

- Anonymous/authenticated behavior untuk `/apply`, `/login`, `/register`, `/provider`, dan area Tenant.
- Registrasi publik selalu menghasilkan Pemohon; client tidak dapat menyuntik role/owner/status/attempt.
- Login pusat untuk Provider Admin, Pemohon empty/pending/rejected, promoted School Admin, Tenant member, dan invalid identity.
- Login Tenant untuk domain valid/tidak ditemukan, own/cross Tenant, Pemohon, Provider Admin, invalid identity, dan continuation attacks.
- Approval mencabut session lama; request berikutnya tidak dapat memakai principal Pemohon stale.
- Authorization dipastikan pada server action dan query, bukan hanya visibilitas tombol.

**End-to-end browser**

1. Anonymous → register dengan intent apply → empty portal → submit → pending read-only.
2. Provider reject dengan alasan → Pemohon melihat immutable history → resubmit attempt baru.
3. Provider approve → session Pemohon tercabut → login ulang → `/apply` menampilkan history dan link Tenant → dashboard Tenant; tidak pernah melihat temporary credential/change-password.
4. Provider-created School Admin tetap login dengan Kredensial sementara → wajib ganti password → dashboard; reset hanya sebelum autentikasi pertama.
5. Provider Admin login pusat menuju `/provider`; Tenant member login pusat/tenant menuju Tenant; cross-domain tidak memberi akses.
6. Open-redirect corpus untuk intent dan continuation tidak pernah meninggalkan origin/portal sah.

**Release validation**

- `pnpm test`, `pnpm typecheck`, `pnpm lint`, dan `pnpm build` lulus.
- Audit data sebelum dan sesudah migrasi menunjukkan nol invariant violation; row count activation sama; setiap approved application memiliki tepat satu Tenant dan setiap Tenant application-derived menunjuk balik.
- Uji migrasi expand→backfill→verify→contract dan prosedur rollback di staging dengan backup. Setelah contract atau data approval baru masuk, rollback harus memakai forward-fix/migrasi pemulihan, bukan menjalankan aplikasi lama terhadap schema baru.

Tidak ada fog baru yang muncul: verifikasi email, UI sengketa/pergantian Pemohon, registrasi pengguna Tenant publik, dan implementasi aktual tetap di luar scope map ini. Handoff ini dapat dipecah menjadi issue implementasi sesuai delapan langkah eksekusi tanpa membuka kembali keputusan produk.
