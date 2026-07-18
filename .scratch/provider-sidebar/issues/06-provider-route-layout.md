Type: task
Status: resolved
Blocked by: 03, 04, 05, 08

## Question

Bagaimana struktur route dan layout Next.js 16 memindahkan area `app/(provider)/dashboard` ke `/provider/*`, memasang sidebar khusus Provider, menempatkan Pengajuan SIMAS dan penyediaan Tenant terpisah dari Onboarding Tenant, serta menghapus ketergantungan pada sidebar Tenant tanpa redirect `/dashboard`?

## Answer

Gunakan folder URL nyata `app/(provider)/provider`, bukan mengganti nama route group menjadi `(provider)` saja. Dalam App Router, route group tidak masuk URL; segment `provider` itulah yang membuat namespace kanonis `/provider/*`. Letakkan guard Provider pada layout server segment tersebut, lalu delegasikan interaksi sidebar ke shell client khusus Provider.

### Struktur route kanonis

```text
app/
  (provider)/
    provider/
      layout.tsx                         # server: guard seluruh area Provider
      _components/
        provider-shell.tsx               # client: SidebarProvider + shell
      page.tsx                           # /provider — Ringkasan
      tenants/
        page.tsx                         # /provider/tenants — tab Tenant/Pengajuan
        [tenantId]/
          page.tsx                       # /provider/tenants/:tenantId — detail Tenant
        applications/
          [applicationId]/
            page.tsx                     # /provider/tenants/applications/:id — review
      features/page.tsx                  # empty state
      billing/page.tsx                   # empty state
      impersonation/page.tsx             # empty state
      audit-log/page.tsx                 # empty state
      support-tickets/page.tsx           # empty state
      settings/page.tsx                  # empty state
```

`/provider` adalah Ringkasan, bukan `/provider/dashboard`; kata “dashboard” tidak dipertahankan sebagai segment URL. `/provider/tenants` memegang kedua tab yang sudah diputuskan. Gunakan query `?tab=applications` untuk membuka tab Pengajuan dari CTA Ringkasan atau sidebar internal halaman; tab tidak membutuhkan route paralel. Detail review tetap memiliki URL sendiri agar dapat ditautkan, di-refresh, dan menjalankan boundary data/otorisasi sendiri. Tindakan approval pada detail Pengajuan adalah **Penyediaan Tenant**, bukan Onboarding Tenant.

Nama URL empty-state menggunakan slug Inggris stabil di atas, sementara label navigasi tetap Ringkasan, Tenant, Fitur, Billing, Impersonasi, Audit Log, Support Ticket, dan Pengaturan Provider. Semua item langsung menuju route sendiri; jangan gunakan href `#`, disabled link palsu, atau catch-all generik. Empty state harus menyebut fitur belum tersedia dan tidak memuat data/mutation domain yang belum dirancang.

### Boundary layout dan sidebar

`app/(provider)/provider/layout.tsx` tetap Server Component. Layout memanggil adapter halaman dari `getProviderAccess()` sebelum merender shell: tanpa sesi diarahkan ke login, sedangkan identitas terautentikasi tanpa grant valid menerima UI akses ditolak. Principal minimum yang dihasilkan guard boleh diteruskan ke shell sebagai data serializable untuk identitas Provider Admin.

Jangan beri directive `"use client"` pada layout guard. Komponen client `ProviderShell` memiliki `SidebarProvider`, `ProviderSidebar`, `SidebarInset`, trigger mobile, header, dan container konten. Dengan demikian hook/interaksi sidebar tidak memaksa pemeriksaan sesi/database atau seluruh layout menjadi client component. `ProviderSidebar` mengimpor `ProviderNavMenu` dan primitive `components/ui/sidebar` saja; area Provider tidak mengimpor `AppSidebar`, `TenantSidebar`, `TenantNavMenu`, `SchoolRole`, atau konfigurasi menu Tenant.

Header tidak memakai judul hard-coded “Dasbor Utama” untuk semua route. Judul halaman dimiliki page masing-masing (atau header menerima label eksplisit dari mekanisme shell yang tidak mencampur konfigurasi Tenant). Root `app/layout.tsx` tetap satu-satunya root layout; tidak diperlukan multiple root layout, parallel route, atau intercepted route untuk struktur ini.

Layout adalah pagar UI, bukan satu-satunya security boundary. Setiap page query, Server Action, Route Handler, dan DAL Provider tetap memanggil guard dekat akses data sesuai keputusan model akses. Dynamic `tenantId` dan `applicationId` hanya locator; server harus memuat record dan memeriksa grant Provider, bukan mempercayai parameter atau state tab.

### Pemisahan lifecycle

- Pengajuan publik sekolah tetap berada di luar layout Provider dan di luar route Tenant terautentikasi; nama route publiknya ditetapkan oleh flow registrasi, bukan ticket ini.
- Provider meninjau Pengajuan di `/provider/tenants/applications/[applicationId]` dan approval atomik menyediakan Tenant serta School Admin pertama.
- `/provider/tenants/[tenantId]` hanya mengamati status onboarding/trial dan menyediakan tindakan Provider yang sudah disepakati; ia tidak memuat form Onboarding Tenant.
- Onboarding Tenant dimiliki area `app/(tenant)/[domain]/...`, dijalankan School Admin pada host Tenant setelah mengganti kredensial sementara. Route final di dalam area Tenant dapat ditentukan bersama rancangan onboarding Tenant tanpa mengubah namespace Provider.
- Hapus halaman lama `/dashboard/onboarding` dan `createTenantAction`; jangan memindahkan atau mengganti labelnya menjadi onboarding Provider karena alur itu melewati Pengajuan SIMAS dan memulai trial pada waktu yang salah.

### Cutover dan routing host

Hapus subtree `app/(provider)/dashboard` setelah fungsi Ringkasan/Tenant dipindahkan. Jangan buat `app/dashboard/page.tsx`, redirect di page, `redirects()` pada `next.config.ts`, rewrite, alias, atau catch-all kompatibilitas. Setelah cutover, `/dashboard` pada host utama harus menghasilkan 404. Perbarui seluruh link internal/fixture/test dari `/dashboard` ke route `/provider/*` yang tepat.

`proxy.ts` tetap mengurus pemetaan host Tenant, bukan otorisasi Provider. Pada host utama, `/provider/*` diteruskan tanpa rewrite. Pada host dengan subdomain Tenant, path `/provider` dan turunannya juga harus dikecualikan dari rewrite ke `/[domain]/provider/*`; respons yang dipilih harus tidak membuka panel Provider pada host Tenant (404 adalah default yang disarankan). Pengecualian ini bersifat routing deterministik, sedangkan grant tetap diverifikasi layout/DAL. Tambahkan test proxy untuk host utama, host Tenant, `/provider`, dan route Tenant biasa.

### Urutan implementasi aman

1. Tambahkan guard/schema Provider dan `ProviderSidebar`/`ProviderNavMenu` yang sudah ditentukan ticket pendahulu.
2. Buat layout server `/provider` dan shell client, lalu pasang Ringkasan dan halaman Tenant pada namespace baru.
3. Tambahkan detail Tenant, detail Pengajuan, dan empty-state route sehingga setiap href sidebar valid.
4. Pindahkan query/mutation ke boundary Provider yang terjaga dan ganti alur lama dengan approval Pengajuan; jangan biarkan action lama hidup selama transisi.
5. Perbarui proxy dan seluruh link, kemudian hapus subtree `/dashboard` dalam perubahan yang sama agar tidak ada dua entry point.
6. Verifikasi boundary Provider/Tenant, lalu lakukan migrasi nama School Admin tanpa menyuplai role Tenant palsu ke Provider.

### Acceptance criteria

- Semua item sidebar Provider memiliki route `/provider/*` yang nyata; `/provider` menampilkan Ringkasan dan `/provider/tenants` menampilkan tab Tenant/Pengajuan.
- Seluruh `/provider/*` dirender melalui layout server yang memeriksa Provider Admin sebelum shell, dan seluruh boundary data/mutation memeriksa ulang akses.
- Sidebar Provider tidak bergantung pada komponen, role, konfigurasi, atau tema sidebar Tenant.
- Approval Pengajuan menyediakan Tenant; tidak ada route atau label Provider yang menyebut proses itu Onboarding Tenant.
- Onboarding Tenant tetap berada pada host/area Tenant dan trial tidak dimulai oleh navigasi atau approval Provider.
- `/dashboard` dan `/dashboard/onboarding` tidak memiliki page, redirect, rewrite, atau alias dan menghasilkan 404 pada host utama.
- Host Tenant tidak me-rewrite atau mengekspos `/provider/*`; route Tenant lain tetap mengikuti rewrite `[domain]` yang ada.
- Test route/layout membuktikan unauthenticated, forbidden, authorized, direct action invocation, active navigation, mobile/collapsed shell, deep-link detail, empty-state route, dan 404 route lama.
