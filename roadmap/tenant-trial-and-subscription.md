# Roadmap Trial dan Langganan Tenant

## Tujuan

Menyediakan lifecycle trial dan langganan Tenant yang konsisten, dapat diaudit, serta diterapkan pada UI, server action, route handler, worker, dan service tanpa keputusan akses yang berbeda-beda.

## Kondisi Saat Ini

### Lifecycle trial

- Tenant dibuat dengan `operationalStatus = active`.
- Trial belum dimulai ketika Provider menyetujui pendaftaran.
- Trial dimulai ketika School Admin menyelesaikan onboarding.
- `trialStartedAt` sama dengan `onboardingCompletedAt`.
- `trialEndsAt` ditetapkan satu bulan kalender UTC setelah trial dimulai.
- Penyelesaian onboarding bersifat idempotent dan tidak memperpanjang trial jika dipanggil kembali.

### Status penggunaan

Status dihitung dari lifecycle Tenant dan tidak disimpan sebagai status trial terpisah:

- `waiting-for-onboarding`
- `in-trial`
- `ending-soon`
- `expired`

Jendela `ending-soon` saat ini adalah tujuh hari sebelum `trialEndsAt`.

### Enforcement yang tersedia

- Trial aktif memberi akses baca dan tulis.
- Trial berakhir mengubah akses yang sudah terintegrasi menjadi hanya-baca.
- Tenant `suspended` hanya dapat membaca dan tidak dapat mengunduh template impor.
- Tenant `closed` diperlakukan sebagai tidak ditemukan.
- Feature gate Ulangan dan PPDB sudah menggunakan access policy yang mempertimbangkan trial.
- Sebagian action lama menggunakan `tenantProtectedAction` dan `isTenantWritable`.

### UI dan monitoring

- Tenant melihat banner ketika trial tersisa maksimal tujuh hari.
- Tenant melihat banner merah setelah trial berakhir.
- Provider dapat melihat tanggal mulai dan berakhirnya trial.
- Provider dapat memfilter Tenant berdasarkan tahap trial.
- Dashboard Provider menampilkan jumlah trial yang segera berakhir.

## Masalah yang Perlu Diselesaikan

1. Belum ada model langganan atau paket berbayar.
2. Belum ada tindakan Provider untuk memperpanjang trial.
3. Belum ada riwayat perubahan trial dan langganan.
4. Enforcement trial belum terpusat untuk seluruh modul.
5. Tidak semua server action, route handler, worker, dan service lama dapat dipastikan menggunakan policy trial.
6. UI read-only belum konsisten; beberapa tombol dapat tetap terlihat walaupun backend menolak operasi.
7. Belum ada grace period dan aturan akses setelah grace period.
8. Belum ada notifikasi terjadwal kepada Tenant atau Provider.
9. Belum ada mekanisme pembayaran, invoice, atau rekonsiliasi pembayaran.
10. Belum ada aturan eksplisit untuk portal publik seperti PPDB ketika trial berakhir.

## Prinsip Desain

### Satu keputusan efektif

UI, backend, worker, dan library harus menggunakan keputusan lifecycle efektif yang sama. Level enforcement adalah lokasi penerapan, bukan policy yang berbeda.

### Fail closed

Nilai lifecycle atau subscription yang hilang, tidak valid, atau kontradiktif harus menolak operasi berisiko tanpa menghapus kemampuan pemulihan oleh Provider.

### Tidak mengandalkan UI

Menyembunyikan atau menonaktifkan tombol hanya untuk UX. Semua operasi perubahan harus diperiksa ulang pada server.

### Tenant isolation

Semua pemeriksaan dan mutasi harus memastikan principal, Tenant, subscription, dan record berada pada `tenantId` yang sama.

### Auditability

Perpanjangan trial, perubahan paket, suspend, aktivasi kembali, dan override manual harus memiliki actor, waktu, alasan, serta nilai sebelum dan sesudah.

### Idempotency

Webhook pembayaran, aktivasi paket, dan perpanjangan trial harus aman terhadap pengiriman ulang.

## Target Arsitektur

```text
Tenant lifecycle
├── Operational status
│   ├── active
│   ├── suspended
│   └── closed
├── Onboarding
│   ├── waiting
│   └── completed
└── Entitlement
    ├── trial
    │   ├── active
    │   ├── ending-soon
    │   ├── grace-period
    │   └── expired
    └── subscription
        ├── active
        ├── past-due
        ├── grace-period
        ├── cancelled
        └── expired
```

Resolver pusat menghasilkan kapabilitas efektif, misalnya:

```ts
type TenantEntitlements = {
  access: "full" | "read-only" | "blocked";
  canRead: boolean;
  canWrite: boolean;
  canDownloadExports: boolean;
  canRunImports: boolean;
  canUsePublicEndpoints: boolean;
  reason: string;
  effectiveUntil: Date | null;
};
```

Feature policy kemudian digabungkan dengan entitlement:

```text
effective permission
= operational lifecycle
  AND trial/subscription entitlement
  AND feature hierarchy
  AND actor role/capability
  AND tenant ownership
```

## Tahap Implementasi

### Fase 1 — Inventarisasi enforcement

- [ ] Petakan seluruh server action Tenant.
- [ ] Petakan seluruh route handler Tenant dan portal publik.
- [ ] Petakan worker dan background job yang melakukan mutasi.
- [ ] Identifikasi operasi yang masih menggunakan pemeriksaan trial lokal.
- [ ] Identifikasi operasi yang belum memiliki pemeriksaan trial.
- [ ] Dokumentasikan matriks baca/tulis/unduh/impor/publik per modul.

**Kriteria selesai:** seluruh entry point memiliki status `protected`, `public-read`, atau `needs-migration`.

### Fase 2 — Policy entitlement pusat

- [ ] Buat registry status entitlement dan alasan penolakan.
- [ ] Buat resolver murni yang menerima lifecycle, trial, subscription, dan waktu sekarang.
- [ ] Pisahkan policy murni dari akses database dan Next.js navigation.
- [ ] Buat adapter server untuk halaman, action, route handler, dan worker.
- [ ] Satukan atau deprecate `isTenantWritable` dan pemeriksaan trial lokal.
- [ ] Tambahkan test matrix untuk kombinasi operational status, trial, dan subscription.

**Kriteria selesai:** satu resolver menghasilkan keputusan efektif untuk seluruh lokasi enforcement.

### Fase 3 — Konsistensi read-only UI

- [ ] Teruskan entitlement efektif ke layout Tenant.
- [ ] Tambahkan status read-only global pada context/layout.
- [ ] Nonaktifkan tombol dan form mutasi ketika Tenant hanya-baca.
- [ ] Tampilkan alasan yang konsisten melalui tooltip atau alert.
- [ ] Pastikan deep link tetap dapat dibaca jika entitlement mengizinkan read-only.
- [ ] Pastikan backend tetap menolak request yang dibuat di luar UI.

**Kriteria selesai:** tidak ada kontrol mutasi aktif ketika entitlement hanya-baca.

### Fase 4 — Manajemen trial oleh Provider

- [ ] Tambahkan aksi memperpanjang trial dengan tanggal atau durasi terkontrol.
- [ ] Wajibkan alasan untuk setiap override.
- [ ] Cegah tanggal akhir lebih awal dari waktu saat ini kecuali operasi khusus.
- [ ] Tambahkan preview nilai sebelum dan sesudah konfirmasi.
- [ ] Tambahkan audit log actor, reason, before, dan after.
- [ ] Tambahkan optimistic concurrency atau transaction lock.
- [ ] Tambahkan batas maksimal perpanjangan sesuai policy bisnis.

**Kriteria selesai:** Provider dapat memperpanjang trial secara aman dan setiap perubahan dapat diaudit.

### Fase 5 — Model paket dan langganan

- [ ] Definisikan paket, harga, periode tagihan, dan feature entitlement.
- [ ] Pisahkan feature configuration Provider dari feature entitlement paket.
- [ ] Tentukan aturan override paket per Tenant.
- [ ] Tambahkan subscription lifecycle dan periode aktif.
- [ ] Tambahkan status `past-due`, `cancelled`, dan `expired`.
- [ ] Tentukan perilaku downgrade dan data retention.
- [ ] Tambahkan tampilan paket aktif pada Provider dan Tenant.

**Kriteria selesai:** Tenant dapat memiliki subscription aktif yang menggantikan entitlement trial.

### Fase 6 — Grace period

- [ ] Tentukan durasi grace period.
- [ ] Tentukan kapabilitas selama grace period.
- [ ] Tentukan kapan akses berubah menjadi read-only atau blocked.
- [ ] Pastikan data tidak dihapus otomatis saat entitlement berakhir.
- [ ] Tampilkan tanggal efektif dan konsekuensi kepada Tenant.

**Kriteria selesai:** transisi trial/subscription berakhir tidak ambigu dan tidak menyebabkan kehilangan data.

### Fase 7 — Notifikasi

- [ ] Buat event untuk trial dimulai, H-7, H-3, H-1, dan berakhir.
- [ ] Buat event subscription past-due dan grace period berakhir.
- [ ] Pastikan pengiriman idempotent.
- [ ] Tambahkan riwayat notifikasi.
- [ ] Dukung email terlebih dahulu; kanal lain mengikuti konfigurasi integrasi.
- [ ] Sediakan reminder pada dashboard Provider.

**Kriteria selesai:** notifikasi tidak dikirim ganda dan status pengiriman dapat ditelusuri.

### Fase 8 — Pembayaran dan webhook

- [ ] Pilih payment provider dan dokumentasikan implikasi biaya serta data sharing.
- [ ] Verifikasi signature webhook.
- [ ] Simpan event provider dengan unique id untuk idempotency.
- [ ] Jangan mempercayai status pembayaran dari client.
- [ ] Rekonsiliasi invoice dan subscription secara transactional.
- [ ] Tambahkan retry serta dead-letter handling.
- [ ] Audit seluruh perubahan entitlement yang berasal dari webhook.

**Kriteria selesai:** pengiriman webhook ulang tidak menggandakan invoice atau memperpanjang subscription dua kali.

### Fase 9 — Observability dan operasi

- [ ] Tambahkan structured logging untuk keputusan entitlement yang ditolak.
- [ ] Tambahkan metric trial ending soon, expired, past-due, dan blocked writes.
- [ ] Tambahkan dashboard rekonsiliasi lifecycle.
- [ ] Tambahkan runbook pemulihan entitlement salah.
- [ ] Tambahkan mekanisme override darurat dengan expiry otomatis.

**Kriteria selesai:** Provider dapat mendeteksi dan memulihkan kesalahan entitlement tanpa perubahan database manual.

## Matriks Akses Awal yang Direkomendasikan

| Kondisi | Baca | Tulis | Unduh | Impor | Endpoint publik |
|---|---:|---:|---:|---:|---:|
| Trial aktif | Ya | Ya | Ya | Ya | Ya |
| Trial segera berakhir | Ya | Ya | Ya | Ya | Ya |
| Trial grace period | Ya | Tidak | Ya | Tidak | Sesuai policy |
| Trial berakhir | Ya | Tidak | Ya | Tidak | Tidak |
| Subscription aktif | Ya | Ya | Ya | Ya | Ya |
| Subscription past-due | Ya | Sesuai grace policy | Ya | Sesuai grace policy | Sesuai policy |
| Tenant suspended | Ya | Tidak | Tidak | Tidak | Tidak |
| Tenant closed | Tidak | Tidak | Tidak | Tidak | Tidak |

Matriks final harus disetujui sebagai keputusan produk sebelum implementasi subscription.

## Pengujian Minimum

- [ ] Boundary tepat pada `trialEndsAt`.
- [ ] Perhitungan satu bulan pada tanggal 28, 29, 30, dan 31.
- [ ] Timezone tidak mengubah timestamp entitlement.
- [ ] Parent feature nonaktif menolak seluruh child meskipun child tersimpan aktif.
- [ ] Trial berakhir menolak action langsung dan bukan hanya tombol UI.
- [ ] Worker memeriksa ulang entitlement ketika job dieksekusi.
- [ ] Tenant tidak dapat mengakses entitlement Tenant lain.
- [ ] Suspend mengalahkan subscription aktif.
- [ ] Closed mengalahkan seluruh feature dan subscription.
- [ ] Webhook duplikat tetap menghasilkan satu perubahan subscription.
- [ ] Perpanjangan trial konkuren tidak saling menimpa.
- [ ] Audit log tidak dapat diubah melalui alur aplikasi biasa.

## Keputusan Produk yang Masih Dibutuhkan

1. Apakah trial selalu satu bulan kalender atau jumlah hari tetap?
2. Apakah Provider boleh memperpanjang trial tanpa batas?
3. Apakah trial berakhir menjadi read-only atau langsung blocked?
4. Apakah PPDB publik tetap aktif selama grace period?
5. Berapa lama grace period?
6. Apakah paket menentukan fitur, kuota, atau keduanya?
7. Bagaimana downgrade menangani data dari fitur yang tidak lagi tersedia?
8. Apakah subscription diperpanjang otomatis?
9. Payment provider apa yang akan digunakan?
10. Berapa lama data Tenant closed dipertahankan sebelum penghapusan?

## Referensi Implementasi Saat Ini

- `monorepo/db/schema.ts`
- `monorepo/lib/tenancy/tenant-onboarding.ts`
- `monorepo/lib/tenancy/tenant-onboarding-data.ts`
- `monorepo/lib/master-data/tenant-master-data-access.ts`
- `monorepo/lib/master-data/tenant-master-data-access-data.ts`
- `monorepo/lib/platform/action-utils.ts`
- `monorepo/lib/features/tenant-feature-policy.ts`
- `monorepo/lib/features/tenant-feature-access-data.ts`
- `monorepo/components/dashboard/trial-banner.tsx`
- `monorepo/lib/provider/provider-tenant-data.ts`
- `monorepo/lib/provider/provider-summary-data.ts`
