Status: resolved
Labels: wayfinder:map

## Destination

Spesifikasi siap implementasi untuk sidebar Provider SIMAS yang memisahkan navigasi, route, identitas, dan otorisasi Provider Admin dari Tenant, sekaligus menetapkan perubahan terbatas yang diperlukan pada sidebar Tenant.

## Notes

Domain: SIMAS, aplikasi SaaS pendidikan multi-tenant. Gunakan istilah dalam [`CONTEXT.md`](../../CONTEXT.md) dan keputusan identitas dalam [`ADR-0001`](../../docs/adr/0001-provider-admin-identity.md).

Skill yang perlu digunakan saat menyelesaikan ticket: `grilling`, `domain-modeling`, dan `prototype` untuk keputusan UI. Effort ini bersifat perencanaan; jangan mengimplementasikan produk sebelum spesifikasi selesai.

Batas yang telah disepakati saat charting:

- Satu role internal: Provider Admin; School Admin adalah role Tenant yang saat ini bernama `superadmin` di kode.
- Route kanonis menggunakan `/provider/*`; `/dashboard` lama langsung diganti tanpa redirect.
- Navigasi Provider terdiri dari Ringkasan, Tenant, Fitur, Billing, Impersonasi, Audit Log, Support Ticket, dan Pengaturan Provider.
- Ringkasan dan Tenant fungsional pada tahap awal; route lain menggunakan empty state.
- Sidebar Provider netral; sidebar Tenant menggunakan tema deep navy yang di-scope khusus Tenant.
- Menu dan route Tenant selain perubahan tema serta migrasi nama role tidak dirancang ulang.

## Decisions so far

- [Bentuk konkret sidebar Provider dan Tenant](issues/01-provider-sidebar-prototype.md) — Gunakan grouped navigation yang mudah dipahami: Provider netral, Tenant deep navy, dengan pola konsisten untuk expanded, collapsed, mobile, active state, identitas, dan empty state.
- [Cakupan halaman inti Provider](issues/02-provider-core-pages.md) — Ringkasan memusatkan perhatian operasional; halaman Tenant menangani daftar dan approval Pengajuan SIMAS, sementara sekolah menjalankan onboarding sebelum trial dimulai.
- [Migrasi identifier School Admin](issues/04-school-admin-role-migration.md) — Ganti identifier UI/type Tenant `superadmin` menjadi `school-admin`, hapus penggunaan palsunya dari area Provider, dan jangan buat migrasi database karena role belum dipersist di repository.
- [Model akses Provider Admin](issues/03-provider-admin-access-model.md) — Gunakan grant satu-ke-satu `provider_admin` pada identitas Better Auth, provisioning idempotent yang menolak user Tenant, dan guard database berlapis pada layout serta setiap boundary server.
- [Batas renderer navigasi Provider dan Tenant](issues/05-navigation-boundary.md) — Gunakan shell, renderer, konfigurasi, dan tipe terpisah per konteks dengan hanya primitive sidebar UI yang digunakan bersama.
- [Struktur route dan layout Provider](issues/06-provider-route-layout.md) — Gunakan namespace nyata `/provider/*`, layout guard server dengan shell Provider client, detail Pengajuan/Tenant terpisah dari Onboarding Tenant, dan hapus `/dashboard` tanpa kompatibilitas URL.
- [Lifecycle Pengajuan SIMAS dan Tenant](issues/08-tenant-application-lifecycle.md) — Pisahkan state Pengajuan, Penyediaan Tenant, aktivasi School Admin, onboarding, dan trial; approval atomik membuat identitas serta credential Better Auth, sedangkan trial baru dimulai saat onboarding selesai.
- [Spesifikasi implementasi sidebar Provider](issues/07-provider-sidebar-spec.md) — Satukan seluruh keputusan menjadi [`spec.md`](spec.md), termasuk kontrak file/route/data/otorisasi/UI, urutan implementasi, validasi, dan acceptance criteria.

## Not yet specified

Tidak ada. Model feature flag Tenant berada di luar effort ini; halaman Fitur hanya menampilkan empty state sampai domain tersebut dirancang terpisah.


## Out of scope

- Redesign menu, route, atau proses bisnis Tenant selain tema sidebar dan migrasi nama `superadmin`.
- Implementasi penuh Billing, Impersonasi, Audit Log, Support Ticket, Fitur, dan Pengaturan Provider.
- Multi-role atau manajemen undangan Provider Admin.
- Domain khusus untuk panel Provider dan kompatibilitas URL lama `/dashboard`.
