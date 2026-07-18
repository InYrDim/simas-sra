# Spesifikasi implementasi sidebar Provider

Status: siap implementasi

## Tujuan

Membangun area Provider SIMAS yang terpisah secara nyata dari area Tenant pada URL, navigasi, identitas, tema, tipe, dan otorisasi. Provider Admin mengelola perhatian operasional, Pengajuan SIMAS, dan Tenant melalui `/provider/*`; School Admin tetap mengelola satu Tenant pada host Tenant.

Implementasi harus mengikuti istilah di [`CONTEXT.md`](../../CONTEXT.md) dan keputusan identitas di [`ADR-0001`](../../docs/adr/0001-provider-admin-identity.md).

## Batas cakupan

### Termasuk

- Sidebar dan shell khusus Provider.
- Route kanonis `/provider/*`.
- Ringkasan serta daftar/detail Tenant dan Pengajuan SIMAS yang fungsional.
- Lifecycle Pengajuan SIMAS, Penyediaan Tenant, aktivasi School Admin, Onboarding Tenant, dan Trial Tenant yang diperlukan halaman inti.
- Grant, provisioning, dan guard Provider Admin.
- Route empty state untuk Fitur, Billing, Impersonasi, Audit Log, Support Ticket, dan Pengaturan Provider.
- Tema deep navy yang hanya berlaku pada sidebar Tenant.
- Migrasi identifier role Tenant `superadmin` menjadi `school-admin`.
- Penghapusan `/dashboard` Provider lama tanpa redirect atau alias.

### Tidak termasuk

- Implementasi domain Fitur/feature flag, Billing, Impersonasi, Audit Log, Support Ticket, atau Pengaturan Provider. Khusus Fitur, jangan membentuk schema feature flag sebelum modelnya diputuskan; route hanya menampilkan empty state.
- Redesign menu, route, atau proses bisnis Tenant selain tema sidebar dan migrasi nama role.
- Multi-role atau undangan Provider Admin.
- Impersonasi saat membuka situs Tenant.
- Kompatibilitas URL `/dashboard`.
- Penentuan route publik Pengajuan SIMAS dan route final Onboarding Tenant; keduanya boleh ditetapkan oleh flow pemiliknya tanpa mengubah kontrak area Provider.

## Istilah dan invariant domain

- **Provider Admin** adalah pengguna internal Provider. Akses berasal hanya dari grant `provider_admin`, bukan role Tenant.
- **School Admin** adalah administrator tertinggi dalam satu Tenant dengan identifier `school-admin`.
- **Pengajuan SIMAS** adalah permohonan immutable sekolah. Provider menyetujui atau menolaknya.
- **Penyediaan Tenant** terjadi saat approval Pengajuan SIMAS dan bukan Onboarding Tenant.
- **Onboarding Tenant** dilakukan School Admin pada area Tenant setelah mengganti kredensial sementara.
- **Trial Tenant** dimulai tepat sekali ketika Onboarding Tenant selesai, bukan saat approval, login pertama, ganti password, atau membuka situs Tenant.

## Struktur file sasaran

Struktur berikut adalah batas modul yang wajib dipertahankan. Nama file service yang setara boleh disesuaikan dengan konvensi repository, tetapi pemisahan Provider/Tenant dan boundary server tidak boleh dilebur.

```text
monorepo/
  app/
    (provider)/
      provider/
        layout.tsx                         # server guard seluruh area Provider
        _components/
          provider-shell.tsx               # client shell + SidebarProvider
          provider-sidebar.tsx
          provider-nav-menu.tsx
          provider-empty-state.tsx
        page.tsx                           # /provider — Ringkasan
        tenants/
          page.tsx                         # tab Tenant/Pengajuan
          [tenantId]/page.tsx              # detail Tenant
          applications/
            [applicationId]/page.tsx       # review Pengajuan
        features/page.tsx
        billing/page.tsx
        impersonation/page.tsx
        audit-log/page.tsx
        support-tickets/page.tsx
        settings/page.tsx
    (tenant)/
      [domain]/
        (authenticated)/
          layout.tsx                       # memakai TenantSidebar
          ...                              # menu/route Tenant lain tetap
  components/
    provider-navigation/
      config.ts
      types.ts
    tenant-navigation/
      tenant-sidebar.tsx
      tenant-nav-menu.tsx
      config.ts
      types.ts
    ui/sidebar.tsx                         # primitive bersama
  db/
    schema.ts
  lib/
    auth.ts
    provider-access.ts                     # server-only access result + adapters
    provider-admin.ts                      # provision/deprovision grant
    simas-applications.ts                  # submit/reject/approve commands
    tenant-lifecycle.ts                    # lifecycle projection/completion
    school-admin-activation.ts             # login/password/reset state
  scripts/
    provision-provider-admin.ts
  types/
    Role.ts                                # atau TenantRole.ts
  proxy.ts
  drizzle/                                 # migrasi hasil drizzle-kit
```

`ProviderSidebar` dan `TenantSidebar` boleh diletakkan dekat route/layout masing-masing. Yang normatif adalah: ada dua shell/renderer/config/type eksplisit, dan keduanya hanya berbagi primitive `components/ui/sidebar`—bukan renderer navigasi generik atau `AppSidebar` dispatcher.

Hapus setelah cutover:

```text
monorepo/app/(provider)/dashboard/
monorepo/components/dashboard/app-sidebar.tsx  # bila tidak lagi dipakai Tenant
```

`createTenantAction` dan form lama `/dashboard/onboarding` tidak dipindahkan; keduanya diganti oleh command approval Pengajuan SIMAS.

## Kontrak route

| URL | Halaman | Perilaku |
| --- | --- | --- |
| `/provider` | Ringkasan | Metrik dan perhatian operasional |
| `/provider/tenants` | Tenant | Tab `Tenant` dan `Pengajuan`; tab Pengajuan memakai `?tab=applications` |
| `/provider/tenants/[tenantId]` | Detail Tenant | Read model Tenant dan tindakan yang diizinkan |
| `/provider/tenants/applications/[applicationId]` | Review Pengajuan | Detail, konflik, approve/reject |
| `/provider/features` | Fitur | Empty state |
| `/provider/billing` | Billing | Empty state |
| `/provider/impersonation` | Impersonasi | Empty state |
| `/provider/audit-log` | Audit Log | Empty state |
| `/provider/support-tickets` | Support Ticket | Empty state |
| `/provider/settings` | Pengaturan Provider | Empty state |

Ketentuan routing:

- `app/(provider)/provider` harus memiliki segment `provider` nyata; route group tidak membentuk URL.
- `/provider` adalah Ringkasan. Jangan membuat `/provider/dashboard`.
- Detail Pengajuan dan Tenant memiliki URL sendiri agar deep-link, refresh, data boundary, dan guard berdiri sendiri.
- Semua href sidebar menunjuk route nyata. Dilarang memakai `#`, disabled link palsu, atau catch-all empty state.
- `/dashboard` dan `/dashboard/onboarding` dihapus tanpa page, redirect, rewrite, alias, atau compatibility catch-all; pada host utama keduanya menghasilkan 404.
- `proxy.ts` meneruskan `/provider/*` tanpa rewrite pada host utama. Pada host Tenant, `/provider` dan turunannya tidak di-rewrite ke `/[domain]/provider/*` dan tidak mengekspos panel Provider; 404 adalah perilaku default.
- Route Tenant lain tetap mengikuti rewrite `[domain]` yang ada.

## Otorisasi Provider

### Schema grant

Tambahkan tabel `provider_admin`:

| Kolom | Kontrak |
| --- | --- |
| `user_id` | `varchar(36)`, primary key, FK `user.id`, `ON DELETE CASCADE` |
| `created_at` | timestamp non-null, default waktu database |

Primary key `user_id` menjamin relasi satu-ke-satu dan menjadi indeks lookup. Jangan tambahkan `id`, `tenant_id`, `role`, atau unique index lain. Definisikan relasi Drizzle satu-ke-satu dengan `user`.

Provider Admin valid harus memenuhi kedua invariant yang dibaca ulang dari database:

1. baris `provider_admin` ada untuk `session.user.id`; dan
2. `user.tenant_id IS NULL`.

Jangan menurunkan grant dari email, role, user tanpa Tenant, prop sidebar, atau data sesi yang dikirim klien.

### Provisioning

`provisionProviderAdmin(userId)` bekerja dalam transaction:

1. lock/read `user` berdasarkan primary key;
2. gagal bila user tidak ada;
3. gagal dengan konflik domain bila `tenant_id` non-null;
4. insert `provider_admin` secara no-op/on-duplicate;
5. hasilkan `created` atau `already-provisioned`.

Entry point operator boleh menerima email yang dinormalisasi lalu di-resolve melalui unique `user.email`, tetapi grant tetap memakai `user.id`. Deprovisioning hanya menghapus `provider_admin`; request berikutnya dengan sesi yang sama harus kehilangan akses. Script bootstrap memakai operasi yang sama dan tidak menerima atau menyimpan password/secret.

### Guard berlapis

`lib/provider-access.ts` harus server-only dan menyediakan:

- `getProviderAccess()`: mengambil sesi via `auth.api.getSession({ headers: await headers() })`, lalu inner join `provider_admin` dan `user` dengan syarat user sesi dan `tenant_id IS NULL`;
- hasil diskriminatif `unauthenticated | forbidden | authorized`;
- principal authorized minimum dan serializable: `userId`, `name`, `email`;
- adapter halaman/layout: redirect unauthenticated ke login dan tampilkan akses ditolak untuk forbidden;
- adapter Route Handler: 401/403;
- adapter Server Action: error otorisasi terkontrol sebelum membaca input atau mutation.

Guard wajib dipanggil pada layout server `/provider`, setiap page query, Server Action, Route Handler, dan fungsi DAL Provider. Layout adalah pagar UI, bukan security boundary. `proxy.ts` tidak melakukan query grant. React `cache()` hanya boleh memoize selama satu request/render, bukan lintas request.

## Schema aplikasi dan migrasi

### `simas_application`

| Kolom | Kontrak |
| --- | --- |
| `id` | UUID primary key |
| `school_name` | data form ternormalisasi |
| `npsn` | nilai kanonis |
| `education_level` | data form |
| `address` | data form |
| `contact_name` | data form |
| `contact_position` | data form |
| `contact_email` | email kanonis |
| `contact_whatsapp` | WhatsApp kanonis |
| `needs_note` | nullable |
| `status` | `pending | approved | rejected`, default `pending` |
| `submitted_at` | non-null |
| `decided_at` | nullable |
| `decided_by_provider_admin_id` | nullable FK `provider_admin.user_id` |
| `rejection_reason` | nullable |
| `approved_tenant_id` | nullable, unique, FK `tenant.id` |

Setelah submit, data asli form immutable; hanya kolom keputusan berubah. Invariant service:

- `pending`: tanpa metadata keputusan, alasan, atau Tenant;
- `approved`: memiliki decision metadata dan Tenant, tanpa alasan;
- `rejected`: memiliki decision metadata dan alasan non-kosong, tanpa Tenant.

Pending/rejected dengan NPSN atau email sama boleh tersimpan untuk riwayat dan pengajuan ulang. Konflik diperiksa ulang saat approval.

### Perubahan `tenant`

Tambahkan:

- `npsn`: kanonis, non-null, unique;
- `source_application_id`: non-null, unique, FK `simas_application.id`;
- `approved_at`: non-null;
- `onboarding_completed_at`: nullable;
- `trial_started_at`: nullable;
- pertahankan/perbarui `trial_ends_at`: nullable.

Relasi Pengajuan–Tenant satu-ke-satu. `tenant.npsn`, `tenant.domain`, `tenant.source_application_id`, dan `user.email` menjadi benteng duplicate approval konkuren.

Sebelum onboarding selesai, ketiga timestamp onboarding/trial null. Setelah selesai, ketiganya non-null, `trial_started_at = onboarding_completed_at`, dan `trial_ends_at` satu bulan kalender setelah waktu mulai menurut UTC.

### Role Tenant pada `user`

Tambahkan sumber role Tenant nyata, misalnya `tenant_role` nullable, dan daftarkan sebagai Better Auth `additionalFields` bila tetap diletakkan pada `user`.

- School Admin pertama: `tenant_id` terisi dan `tenant_role = "school-admin"`.
- Provider Admin: `tenant_id = NULL`, `tenant_role = NULL`; akses tetap dari `provider_admin`.

Jika nanti role dipindah ke tabel membership, invariant tetap sama dan Provider Admin tidak masuk role Tenant.

### `school_admin_activation`

| Kolom | Kontrak |
| --- | --- |
| `user_id` | primary key, FK cascade `user.id` |
| `tenant_id` | non-null, FK `tenant.id` |
| `temporary_credential_issued_at` | non-null |
| `first_authenticated_at` | nullable |
| `password_change_required` | boolean non-null, default `true` |
| `password_changed_at` | nullable |

Tabel ini hanya untuk School Admin pertama hasil approval. Password/hash tetap hanya pada credential `account` Better Auth; jangan simpan plaintext atau hash kedua.

### Urutan migrasi data/schema

1. Audit data environment target sebelum membuat kolom Tenant non-null. Repository saat ini tidak mempersist role dan row Tenant lama dianggap data pengembangan yang perlu seed ulang atau kebijakan migrasi eksplisit.
2. Tambahkan `provider_admin`, `simas_application`, `school_admin_activation`, relasi, dan kolom nullable yang diperlukan terlebih dahulu.
3. Aktifkan `emailAndPassword.enabled` dan tambahkan `tenantRole`/`tenant_role` pada konfigurasi/schema Better Auth tanpa menghapus additional field `tenantId` yang ada.
4. Untuk data yang dipertahankan, jangan mengarang `source_application_id`, NPSN, atau timestamp lifecycle. Hentikan rollout sampai kebijakan backfill nyata disetujui. Untuk data development, reset/seed ulang.
5. Setelah backfill atau reset tervalidasi, terapkan constraint non-null dan unique final pada Tenant.
6. Generate migrasi dengan Drizzle, review SQL, jalankan migrasi melalui `pnpm db:migrate`, lalu jalankan integrity query/test.
7. Migrasi `superadmin` tidak menghasilkan SQL pada kondisi repository saat ini. Bila audit deployment menemukan data role eksternal, tambahkan migrasi atomik `superadmin -> school-admin`, verifikasi nilai lama nol, baru hapus kompatibilitas penulisan lama.
8. Migrasi tidak boleh menebak Provider Admin dari role, email, atau seluruh user tanpa Tenant.

## Lifecycle dan command server

### Pengajuan SIMAS

Form publik mengumpulkan nama resmi sekolah, NPSN, jenjang, alamat, nama/jabatan penanggung jawab, email, WhatsApp, dan catatan kebutuhan opsional. Sekolah tidak memilih subdomain. Command submit menormalisasi NPSN, email, WhatsApp, dan whitespace sebelum menyimpan nilai kanonis.

Transisi hanya:

```text
pending -> approved
pending -> rejected
```

Keputusan terminal read-only: tidak ada edit, reopen, undo, revisi, approval bertingkat, atau pengajuan ulang otomatis. Reject mengunci row, mewajibkan alasan, dan tidak membuat Tenant/user. Retry approval pada row approved menghasilkan `already-approved` dengan Tenant yang sama dan tanpa menerbitkan ulang credential; approval row rejected gagal conflict.

### Approval dan Penyediaan Tenant

`approveApplication(applicationId, subdomain, providerPrincipal)` adalah satu-satunya jalur Penyediaan Tenant versi pertama:

1. guard Provider dijalankan sebelum input/mutation;
2. normalisasi dan validasi subdomain;
3. buat credential sementara CSPRNG minimal 128-bit entropy dan hash dengan hasher Better Auth sebelum transaction;
4. transaction + `SELECT ... FOR UPDATE` Pengajuan;
5. tangani state terminal secara idempoten/conflict;
6. periksa ulang konflik NPSN, subdomain, dan email di dalam transaction;
7. insert Tenant dengan timestamp onboarding/trial null;
8. insert Better Auth `user` (`tenant_id`, `tenant_role = school-admin`, `email_verified = true`);
9. insert credential `account` (`provider_id = credential`, `account_id = user.id`, password hash);
10. insert `school_admin_activation`;
11. tandai Pengajuan approved beserta decision metadata dan Tenant;
12. commit, lalu tampilkan plaintext credential satu kali.

Semua ID dibuat aplikasi. Duplicate key dipetakan ke konflik domain yang aman. Kegagalan apa pun me-rollback Tenant, user, account, activation, dan keputusan. Jangan memanggil `auth.api.signUpEmail` di dalam transaction karena write/session-nya tidak mengikuti transaction Drizzle command.

Plaintext credential tidak boleh disimpan, di-log, dimasukkan URL/analytics/error monitoring, atau dapat dibaca ulang. Jika response hilang, gunakan reset credential sementara.

### Aktivasi School Admin

- Hook server sign-in email/password mencatat `first_authenticated_at` secara idempoten untuk user dengan activation row.
- Reset credential sementara hanya sebelum `first_authenticated_at`, ketika `password_change_required = true`; transaction mengganti hash, memperbarui waktu penerbitan, mencabut semua sesi, lalu menampilkan secret baru satu kali setelah commit.
- Setelah autentikasi pertama, Provider menolak reset sementara dan menggunakan flow reset password Better Auth biasa.
- Selama `password_change_required = true`, tenant guard hanya mengizinkan ganti password dan sign-out. Fitur Tenant dan completion onboarding ditolak server.
- Ganti password memverifikasi password lama, memakai hasher Better Auth yang sama, mencabut sesi lain, lalu menandai flag selesai secara idempoten.

### Onboarding dan trial

`completeTenantOnboarding(tenantPrincipal, payload)` hanya untuk School Admin Tenant tersebut yang sudah mengganti password:

1. guard membaca sesi, `user.tenant_id`, `tenant_role = school-admin`, activation, dan kecocokan Tenant dari database;
2. lock Tenant berdasarkan principal tepercaya, bukan `tenantId` form;
3. bila sudah selesai, hasil idempoten tanpa menggeser trial;
4. validasi dan simpan data onboarding;
5. gunakan satu `now` UTC, set `onboarding_completed_at` dan `trial_started_at` sama, lalu `trial_ends_at` satu bulan kalender sesudahnya;
6. commit seluruh konfigurasi dan timestamp bersama.

Label tahap penggunaan merupakan proyeksi query, bukan enum tersimpan:

- **Menunggu onboarding**: `onboarding_completed_at IS NULL`;
- **Dalam trial**: selesai dan akhir trial lebih dari tujuh hari;
- **Segera berakhir**: belum berakhir dan berada dalam tujuh hari;
- **Trial berakhir**: `trial_ends_at <= now`.

## Halaman fungsional Provider

### Ringkasan

Tampilkan empat metrik yang dapat ditindaklanjuti:

1. Pengajuan menunggu peninjauan;
2. total Tenant yang sudah disediakan;
3. Tenant menunggu onboarding;
4. Trial segera berakhir (berakhir dalam tujuh hari).

Di bawah metrik tampilkan maksimal lima Pengajuan terbaru dan lima Tenant terbaru. CTA utama **Lihat Pengajuan** menuju `/provider/tenants?tab=applications`. Jangan menduplikasi daftar Tenant lengkap atau menyediakan CTA membuat Tenant langsung.

### `/provider/tenants`

Gunakan tab `Tenant` dan `Pengajuan`.

Tab Tenant:

- pencarian nama sekolah, NPSN, subdomain, atau email School Admin;
- filter tahap penggunaan;
- pengurutan tanggal dan nama;
- pagination;
- kolom minimum: nama sekolah, NPSN, subdomain, School Admin pertama, tahap penggunaan, tanggal persetujuan;
- tindakan **Lihat detail** dan **Buka situs Tenant**.

Membuka situs tidak membuat sesi Tenant dan bukan impersonasi. Tidak ada edit, hapus, suspend, perpanjangan trial, pengaturan fitur, atau impersonasi pada versi pertama.

Tab Pengajuan:

- pencarian, filter status, pengurutan, dan pagination;
- status UI **Menunggu peninjauan**, **Disetujui**, **Ditolak**;
- detail menampilkan seluruh data asli serta konflik NPSN/email terhadap Pengajuan atau Tenant lain;
- Provider hanya menentukan subdomain saat approval; saran awal berasal dari slug nama sekolah, tetapi dapat diubah;
- data asli Pengajuan tidak dapat diedit;
- reject mewajibkan alasan.

### Detail Tenant

Tampilkan identitas sekolah/Tenant, School Admin pertama dan status akunnya, tanggal persetujuan, status onboarding, periode trial, dan ringkasan Pengajuan asal. Reset credential sementara tersedia hanya sebelum login pertama; hasil ditampilkan satu kali. Setelah akun aktif, arahkan ke reset password biasa.

## Navigasi dan shell

### Konfigurasi Provider

Gunakan tipe terpisah tanpa role Tenant, misalnya:

```ts
type ProviderNavItem = {
  title: string
  href: string
  icon: LucideIcon
  group: "main" | "operations"
  availability: "available" | "empty-state"
}
```

`availability` hanya metadata presentasi/tes; link tetap aktif menuju route nyata. Konfigurasi:

| Grup | Label | Href | Ketersediaan |
| --- | --- | --- | --- |
| Utama | Ringkasan | `/provider` | fungsional |
| Utama | Tenant | `/provider/tenants` | fungsional |
| Utama | Fitur | `/provider/features` | empty state |
| Utama | Billing | `/provider/billing` | empty state |
| Operasional | Impersonasi | `/provider/impersonation` | empty state |
| Operasional | Audit Log | `/provider/audit-log` | empty state |
| Operasional | Support Ticket | `/provider/support-tickets` | empty state |
| Operasional | Pengaturan Provider | `/provider/settings` | empty state |

Active state menggunakan pathname dengan segment boundary: `/provider` hanya aktif tepat pada root; `/provider/tenants` tetap aktif pada detail Tenant/Pengajuan; item lain aktif pada subtree-nya. Query tab tidak mengubah item aktif.

`ProviderShell` adalah Client Component yang memuat `SidebarProvider`, `ProviderSidebar`, `SidebarInset`, trigger mobile, header, dan container. `app/(provider)/provider/layout.tsx` tetap Server Component dan menjalankan guard sebelum shell. Judul halaman dimiliki page atau diberikan eksplisit; jangan hard-code “Dasbor Utama” untuk semua route.

### Perilaku responsif dan aksesibilitas

- **Desktop expanded:** tampilkan identitas konteks Provider, grouped navigation, dan identitas Provider Admin (`name`/`email`) dari principal minimum.
- **Desktop collapsed:** pertahankan ikon, active state, dan tooltip nama setiap menu; identitas tidak boleh berubah menjadi identitas Tenant.
- **Mobile:** sidebar menjadi drawer; trigger memiliki accessible name, state buka/tutup dapat dibaca teknologi asistif, fokus dikelola oleh primitive, dan pemilihan link menutup drawer.
- Active item harus dapat dikenali tanpa hanya mengandalkan warna (`aria-current="page"` atau semantik setara).
- Ikon dekoratif disembunyikan dari accessibility tree; target interaksi dan keyboard navigation mengikuti primitive sidebar.
- Sidebar Provider memakai tema netral. Token/selector deep navy tidak boleh bocor ke Provider atau root global.

### Empty state

Setiap route nonfungsional merender empty state yang:

- memiliki judul sesuai fitur;
- menyatakan fitur belum tersedia;
- menjelaskan secara singkat konten/kemampuan yang kelak muncul;
- tidak memuat data, tombol mutation, CTA palsu, atau schema domain yang belum dirancang;
- tetap berada dalam shell sehingga link, active state, collapsed mode, dan mobile dapat diuji.

## Perubahan sidebar Tenant yang diizinkan

1. Ganti `AppSidebar`/renderer campuran menjadi `TenantSidebar` + `TenantNavMenu` yang hanya dipakai layout Tenant.
2. Pertahankan seluruh label, href, grouping, submenu, dan urutan menu Tenant saat ini.
3. Terapkan deep navy pada root/sidebar Tenant saja melalui class/token scoped; foreground, hover, active, border, dan focus ring harus tetap memiliki kontras yang memadai.
4. Ganti identifier TypeScript/UI `superadmin` menjadi `school-admin` dan label “Superadmin” menjadi “School Admin”. Jangan sediakan alias runtime.
5. Pisahkan tipe pengguna `TenantRole` dari matcher konfigurasi `TenantRole | "*"`; wildcard tidak boleh menjadi role user.
6. `Provider Admin` tidak masuk union Tenant. Provider tidak mengimpor `TenantSidebar`, `TenantNavMenu`, `TenantRole`, atau config Tenant.
7. Filtering menu Tenant hanya mengendalikan visibilitas UI dan tidak menggantikan guard route/action/DAL.
8. Setelah perubahan, pencarian case-insensitive `superadmin` pada runtime/docs aktif harus nol; catatan historis `.scratch` boleh tetap.

## Urutan implementasi

1. Tambahkan schema/grant Provider, role Tenant nyata, activation/lifecycle schema, konfigurasi Better Auth, migrasi, dan integrity tests.
2. Implementasikan `getProviderAccess`, adapter boundary, provisioning/deprovisioning, dan script bootstrap.
3. Implementasikan command submit/reject/approve, credential lifecycle, dan completion onboarding beserta integration test Better Auth.
4. Buat tipe/config/renderer Provider dan pisahkan renderer Tenant; scope tema Tenant deep navy dan migrasikan `school-admin` secara atomik.
5. Buat layout server `/provider`, `ProviderShell`, Ringkasan, Tenant/Pengajuan, detail, dan seluruh route empty state.
6. Pindahkan query/mutation lama ke boundary terjaga; hapus `createTenantAction` dan `/dashboard/onboarding`.
7. Perbarui `proxy.ts`, link, fixture, dan test; hapus subtree `/dashboard` pada perubahan yang sama agar tidak ada dua entry point.
8. Jalankan migrasi dan validasi end-to-end pada host utama serta host Tenant.

## Strategi validasi

Minimal jalankan:

- type-check/build Next.js;
- ESLint;
- test unit domain untuk state machine, proyeksi trial, normalisasi, dan active matching;
- test integration database untuk transaction/unique constraint/rollback;
- test integration Better Auth untuk login credential hasil approval, reset, dan perubahan password;
- test route/layout/action untuk guard;
- test proxy untuk host utama, host Tenant, `/provider`, dan route Tenant biasa;
- test komponen/a11y sidebar pada expanded, collapsed, dan mobile.

## Acceptance criteria

### Route dan shell

- [ ] `/provider` menampilkan Ringkasan dan seluruh item sidebar memiliki route `/provider/*` nyata.
- [ ] `/provider/tenants` memiliki tab Tenant/Pengajuan; detail Tenant dan Pengajuan dapat di-deep-link dan di-refresh.
- [ ] `/dashboard` serta `/dashboard/onboarding` tidak memiliki page, redirect, rewrite, alias, atau catch-all dan menghasilkan 404 pada host utama.
- [ ] Host Tenant tidak me-rewrite atau mengekspos `/provider/*`; route Tenant biasa tetap bekerja.
- [ ] Layout Provider tetap server-side dan menjalankan guard sebelum merender client shell.

### Otorisasi

- [ ] Tanpa sesi, halaman Provider redirect ke login dan endpoint mengembalikan 401.
- [ ] User Tenant—termasuk School Admin—ditolak 403 meski memanggil URL/action langsung.
- [ ] User tanpa Tenant tetapi tanpa grant ditolak 403.
- [ ] State invalid `provider_admin` + `user.tenant_id` non-null ditolak dan terdeteksi integrity test.
- [ ] Provider Admin valid dapat membaca dan menjalankan action Provider.
- [ ] Setiap query/action/handler/DAL Provider memeriksa guard, bukan hanya layout.
- [ ] Provisioning dua kali membuat satu grant dan hasil kedua `already-provisioned`; user hilang/Tenant gagal tanpa perubahan parsial.
- [ ] Deprovisioning memblokir sesi yang sama pada request berikutnya.

### Navigasi dan UI

- [ ] Provider memakai sidebar netral dengan grouped navigation, identitas Provider, active state, collapsed tooltip, dan mobile drawer yang aksesibel.
- [ ] Active state root/subtree benar, termasuk detail Tenant/Pengajuan dan query tab.
- [ ] Provider tidak mengimpor komponen, role, config, atau tema Tenant.
- [ ] Semua route nonfungsional menampilkan empty state informatif tanpa mutation/data/schema domain palsu.
- [ ] Ringkasan menampilkan empat metrik, maksimal lima Pengajuan terbaru, maksimal lima Tenant terbaru, dan CTA Lihat Pengajuan.
- [ ] Daftar/detail Tenant dan Pengajuan menyediakan field, filter, tindakan, serta pembatasan versi pertama sesuai spesifikasi.

### Lifecycle dan data

- [ ] Approval atomik menghasilkan tepat satu Tenant, School Admin, credential account, activation row, dan keputusan Pengajuan.
- [ ] Approval konkuren atau konflik NPSN/subdomain/email menghasilkan satu pemenang dan rollback utuh untuk loser.
- [ ] Reject tanpa alasan gagal; keputusan terminal immutable.
- [ ] Credential sementara dapat dipakai login tetapi user hanya dapat ganti password/sign-out sampai kewajiban selesai.
- [ ] Plaintext credential hanya tampil sekali dan tidak dapat dibaca ulang; reset pra-login mengganti credential serta mencabut sesi, reset pasca-login ditolak.
- [ ] Tidak ada state parsial user/account/activation atau timestamp onboarding/trial.
- [ ] Trial tetap null setelah approval, login, dan ganti password; mulai tepat sekali saat completion onboarding dan retry tidak mengubah tanggal.
- [ ] School Admin Tenant lain atau role lain tidak dapat menyelesaikan onboarding target.

### Tenant dan migrasi

- [ ] Sidebar Tenant memakai deep navy yang scoped dan menu/route/grouping selain rename tidak berubah.
- [ ] UI/type aktif hanya memakai `school-admin`/“School Admin”; runtime tidak memiliki `superadmin`.
- [ ] `TenantRole` tidak memuat Provider Admin atau wildcard; wildcard hanya pada matcher menu.
- [ ] Tidak dibuat migrasi role database palsu ketika role belum dipersist.
- [ ] Migrasi tidak mengarang data NPSN, Pengajuan asal, atau lifecycle untuk Tenant lama; rollout berhenti bila data nyata memerlukan kebijakan backfill.
