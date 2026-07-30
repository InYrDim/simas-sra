# Audit Feedback Child Feature Tenant

## Tujuan

Memastikan child feature yang dinonaktifkan Provider menghasilkan feedback pada UI berupa kontrol disabled dan tooltip, tanpa mengandalkan halaman 403 sebagai feedback utama. Pemeriksaan backend tetap wajib dan tidak boleh dilemahkan.

## Ringkasan Temuan

### Akar masalah

`MasterDataPrincipal.capabilities.write` saat ini mencerminkan lifecycle Tenant seperti trial aktif, trial berakhir, atau suspended. Nilai tersebut tidak mencerminkan keputusan efektif child feature berikut:

- `masterDataWrite`
- `masterDataImportDownload`
- `masterDataImportValidation`
- `masterDataImportExecution`
- `ulanganWrite`
- `ppdbWrite`
- `ppdbPublic`

Akibatnya, halaman yang dibuka melalui operasi `read` dapat menerima `principal.capabilities.write = true` meskipun child feature write dinonaktifkan Provider. Kontrol UI tetap aktif, sedangkan server action melakukan pemeriksaan ulang dan berakhir pada 403.

### Enforcement yang harus dipertahankan

- Layout/page gate tetap menolak deep link yang benar-benar tidak dapat dibaca.
- Server action dan route handler tetap memeriksa child feature.
- Worker tetap memeriksa ulang feature saat eksekusi.
- Disabled state dan tooltip hanya feedback UI, bukan mekanisme keamanan.

## Matriks Registry dan Trigger

| Feature | Jenis | Trigger UI yang ditemukan | Kondisi sekarang | Gap feedback |
|---|---|---|---|---|
| `masterData` | Parent | Menu Overview, Import, Master Data; seluruh `/master/**` | Menu belum semuanya terikat feature; deep link dapat berakhir 403 | Menu root terkait harus disabled dan tooltip menjelaskan parent dinonaktifkan Provider |
| `masterDataRead` | Read child | Menu Overview, Import, Master Data; link detail/revisi/history | Layout `/master/**` menolak akses | Menu harus disabled; link turunan tidak relevan jika halaman tidak dapat dibuka |
| `masterDataWrite` | Action child | Seluruh create/edit/archive/reactivate/lifecycle/relationship form Data Master | Banyak halaman memakai `principal.capabilities.write`, yang tidak merepresentasikan child flag | Semua trigger mutasi harus tetap terlihat tetapi disabled dengan tooltip Provider |
| `masterDataImportDownload` | Action child | Unduh template Siswa, Guru, Staf; unduh koreksi; unduh hasil eksekusi | Link selalu aktif; route baru menolak saat diklik | Semua link download terkait harus menjadi kontrol disabled non-link dengan tooltip |
| `masterDataImportValidation` | Action child | Upload workbook awal; upload revision; simpan keputusan review | UI hanya melihat lifecycle write; action/route menolak child feature | File input, select keputusan, dan tombol submit harus disabled dengan tooltip |
| `masterDataImportExecution` | Action child | Konfirmasi dan eksekusi baris impor | UI hanya melihat lifecycle write dan unresolved state | Tombol eksekusi harus disabled jika feature mati, dengan tooltip yang dibedakan dari unresolved validation |
| `ulangan` | Parent | Menu Ulangan | Sudah disabled, abu-abu, terkunci, dan bertooltip | Tidak ada gap parent navigation |
| `ulanganRead` | Read child | Menu Ulangan dan seluruh halaman `/ulangan/**` | Menu memakai effective `ulanganRead`; layout menolak deep link | Sudah sesuai untuk navigasi; direct URL tetap 403 sebagai defense in depth |
| `ulanganWrite` | Action child | Buat sesi, tambah/hapus/demo soal, mulai/akhiri sesi, absensi, simpan nilai, finalisasi, penilaian otomatis | UI memakai lifecycle `capabilities.write`; action menolak child feature | Semua trigger mutasi Ulangan harus disabled dengan tooltip |
| `ppdb` | Parent | Menu PPDB | Sudah disabled, abu-abu, terkunci, dan bertooltip | Tidak ada gap parent navigation |
| `ppdbRead` | Read child | Menu dan halaman pengelolaan `/[domain]/ppdb/**` | Menu memakai effective `ppdbRead`; layout menolak deep link | Sudah sesuai untuk navigasi; direct URL tetap 403 sebagai defense in depth |
| `ppdbWrite` | Action child | Buat/ubah/publikasi/akhiri sesi, keputusan pendaftar, konfigurasi/publikasi hasil, akses cek hasil | Sebagian memakai lifecycle `writable`, sebagian link/form selalu aktif | Semua trigger mutasi PPDB harus disabled dengan tooltip |
| `ppdbPublic` | Public child | Lihat Form Publik, submit pendaftaran, cek status | Resolver publik menjadi not-found; link admin “Lihat Form Publik” tidak memeriksa child | Link preview publik harus disabled dengan tooltip; halaman publik tetap tidak-found/fail-closed |
| `advancedAnalytics` | Display child | Panel Advanced Analytics pada dashboard | Sudah menampilkan locked state dan pesan menghubungi Provider | Sudah memiliki feedback; dapat diselaraskan wording/ikon dengan pola feature feedback |

## Inventaris Trigger Data Master

### `masterDataWrite`

Kelompok halaman yang menggunakan `principal.capabilities.write` atau prop `writable` untuk memutuskan kontrol mutasi:

- `app/(tenant)/[domain]/(authenticated)/master/profil/page.tsx`
- `app/(tenant)/[domain]/(authenticated)/master/tahun-ajaran/page.tsx`
- `app/(tenant)/[domain]/(authenticated)/master/siswa/page.tsx`
- `app/(tenant)/[domain]/(authenticated)/master/guru/page.tsx`
- `app/(tenant)/[domain]/(authenticated)/master/staf/page.tsx`
- `app/(tenant)/[domain]/(authenticated)/master/mapel/page.tsx`
- `app/(tenant)/[domain]/(authenticated)/master/rombel/page.tsx`
- `app/(tenant)/[domain]/(authenticated)/master/sarpras/page.tsx`
- `app/(tenant)/[domain]/(authenticated)/master/sarpras/aset/page.tsx`
- `app/(tenant)/[domain]/(authenticated)/master/organisasi/page.tsx`
- `app/(tenant)/[domain]/(authenticated)/master/organisasi/ekstrakurikuler/page.tsx`

Trigger mencakup:

- Tambah record.
- Edit record.
- Perubahan lifecycle/status.
- Archive dan reactivate.
- Assignment dan relationship.
- Pengelolaan anggota, wali kelas, pembina, peserta, serta jabatan.
- Upload logo, akreditasi, dan assignment kepala sekolah.

Beberapa row action sudah menampilkan ikon disabled, tetapi alasannya masih generik “tidak tersedia” dan tidak membedakan feature Provider dari lifecycle read-only.

### `masterDataImportDownload`

- `master/import/page.tsx`
  - “Unduh Siswa”
  - “Unduh Guru”
  - “Unduh Staf”
  - Target: `/master/import/template/[kind]`
- `master/import/[revisionId]/page.tsx`
  - “Unduh lembar kerja koreksi”
  - Target: `/master/import/[revisionId]/correction`
- `master/import/[revisionId]/execution/[executionId]/page.tsx`
  - “Download workbook hasil”
  - Target: `/master/import/[revisionId]/execution/[executionId]/result`

Catatan: koreksi dan hasil eksekusi saat ini menggunakan operasi read pada sebagian route, sehingga registry dan enforcement download perlu diselaraskan sebelum UI mengandalkan keputusan yang sama.

### `masterDataImportValidation`

- `master/import/page.tsx`
  - File input workbook.
  - “Unggah dan validasi”.
  - Target: `/master/import/upload`.
- `master/import/[revisionId]/page.tsx`
  - File input koreksi.
  - “Unggah sebagai Revisi Impor baru”.
  - Target: `/master/import/[revisionId]/revision`.
  - Select keputusan warning.
  - “Simpan keputusan”.
  - Target: `saveDecisionAction`.

### `masterDataImportExecution`

- `master/import/[revisionId]/page.tsx`
  - Pemilihan baris.
  - Konfirmasi eksekusi.
  - Tombol eksekusi impor.
  - Target: `executeImportAction` dan worker import.

### Demo master data

- `master/import/demo-data-import-dialog.tsx`
  - “Isi Data Demo”.

Demo master data menulis Data Master tetapi belum mempunyai child feature khusus. Untuk saat ini harus mengikuti `masterDataWrite`. Jika Provider perlu mengontrol demo secara terpisah, tambahkan feature deklaratif baru; jangan menumpangkannya ke import execution tanpa keputusan produk.

## Inventaris Trigger Ulangan

Semua trigger berikut menargetkan server action yang sudah menggunakan `ulanganWrite`, tetapi feedback UI masih berasal dari lifecycle write:

### Sesi

- `ulangan/page.tsx`
  - `CreateSessionDialog`: buat sesi.
- `ulangan/create/page.tsx`
  - `CreateQuizSessionForm`: buat sesi.
- `ulangan/[sessionId]/page.tsx`
  - “Mulai Ulangan”.
  - `ActiveSessionControls`: absensi dan akhiri sesi.

### Soal

- `ulangan/[sessionId]/page.tsx`
  - `DemoQuestionsDialog`: “Isi Demo Soal”.
  - `AddQuestionForm`: “Tambah Soal”.
  - Tombol hapus soal.

### Absensi

- `ulangan/[sessionId]/attendance-dialog.tsx`
  - Pilihan status hadir/terlambat/alpa.
  - “Simpan”.
  - “Akhiri Sesi”.
- `ulangan/[sessionId]/absensi/page.tsx`
  - Tombol Hadir.
  - Tombol Terlambat.
  - Tombol Alpa.

### Penilaian

- `ulangan/[sessionId]/penilaian/page.tsx`
  - “Proses Penilaian Otomatis”.
  - “Siapkan Peserta Penilaian”.
- `ulangan/[sessionId]/penilaian/offline-grading-form.tsx`
  - Input nilai.
  - “Simpan Nilai”.
  - “Selesaikan Penilaian”.

### Feedback yang direkomendasikan

- Halaman tetap dapat dibaca jika `ulanganRead` aktif.
- Seluruh trigger mutasi tetap terlihat agar pengguna memahami fitur tersedia dalam produk, tetapi disabled.
- Tooltip standar: “Pengelolaan Ulangan dinonaktifkan oleh Provider untuk Tenant ini.”
- Disabled karena state domain, misalnya sesi sudah selesai, tetap memakai alasan domain yang lebih spesifik.
- Jika feature dan state domain sama-sama menolak, alasan feature Provider menjadi alasan utama karena tidak dapat dipulihkan pengguna Tenant.

## Inventaris Trigger PPDB

### Sesi dan form

- `ppdb/page.tsx`
  - “Buat Sesi PPDB”.
  - “Lanjutkan Buat Form”.
  - “Akhiri Sesi PPDB”.
  - “Konfigurasi Hasil”.
- `ppdb/settings/page.tsx`
  - `CreateSessionForm`.
  - `PpdbFieldBuilder`.
  - “Lihat Form Publik” terkait `ppdbPublic`.
- `ppdb/settings/field-builder.tsx`
  - Tambah field template.
  - Tambah, ubah, urutkan, duplikat, dan hapus pertanyaan.
  - Simpan/publikasikan struktur form.

### Pendaftar

- `ppdb/submissions-table.tsx`
  - Keputusan accepted/rejected.
  - Input score.
- `ppdb/document-preview.tsx`
  - Preview/download dokumen adalah read operation dan harus tetap tersedia saat hanya `ppdbWrite` mati.
- `ppdb/print-submissions-dialog.tsx`
  - Cetak daftar adalah read/export operation; registry belum memiliki child khusus dan sementara mengikuti `ppdbRead`.

### Hasil

- `ppdb/result-settings-form.tsx`
  - “Simpan Pengaturan Hasil”.
  - “Publikasikan Hasil”.
- `ppdb/result-check-access-toggle.tsx`
  - Switch akses cek hasil.
  - “Simpan Akses”.
- `ppdb/riwayat/[sessionId]/page.tsx`
  - “Konfigurasi Hasil”.

### Public PPDB

- `app/ppdb/[domain]/page.tsx`
- `app/ppdb/[domain]/[sessionId]/daftar/page.tsx`
- `app/ppdb/[domain]/actions.ts`
  - Submit pendaftaran.
- `app/ppdb/[domain]/status/page.tsx`
- `app/ppdb/[domain]/status/actions.ts`
  - Cek status.

Portal publik tidak mempunyai sesi Tenant untuk menampilkan tooltip. Fail-closed/not-found tetap tepat. Feedback disabled hanya diterapkan pada link “Lihat Form Publik” di UI admin Tenant ketika `ppdbPublic` mati.

## Advanced Analytics

- `components/dashboard/advanced-analytics.tsx` sudah memeriksa `advancedAnalytics`.
- Ketika disabled, panel tetap terlihat sebagai locked state dengan penjelasan menghubungi Provider.
- Tidak ada server mutation atau action trigger untuk feature ini.
- Wording dapat distandardisasi menjadi Bahasa Indonesia dan memakai alasan yang sama dengan feature feedback module.

## Seam yang Direkomendasikan

Jangan menambahkan pemeriksaan database secara terpisah pada setiap tombol. Buat satu module feedback yang dalam dengan interface kecil.

### Resolver server

Resolver menggabungkan:

- Effective feature policy.
- Lifecycle/trial capability.
- Role/capability.
- Alasan penolakan yang aman ditampilkan.

Contoh hasil:

```ts
type TenantFeatureAvailability = Readonly<{
  enabled: boolean;
  reason: "provider-disabled" | "read-only" | "role" | null;
  message: string | null;
}>;
```

Halaman dapat meminta snapshot seluruh feature sekali per request, bukan query per tombol.

### Adapter UI

Sediakan adapter reusable untuk trigger:

```tsx
<FeatureAction
  availability={availability.masterDataImportExecution}
  enabledTrigger={<Button>Eksekusi impor</Button>}
  disabledTrigger={<Button disabled>Eksekusi impor</Button>}
/>
```

Interface alternatif yang lebih kecil adalah helper pembentuk props:

```ts
const feedback = featureActionProps(availability.ulanganWrite);
<Button disabled={feedback.disabled} aria-describedby={feedback.descriptionId} />
```

Untuk tooltip pada disabled button, trigger tooltip harus berupa wrapper focusable seperti `span`, karena elemen button disabled tidak selalu menerima hover/focus event secara konsisten.

### Prioritas alasan disabled

1. `provider-disabled`
2. `read-only` karena trial/subscription/lifecycle
3. Role tidak memadai
4. State domain, misalnya sesi sudah dipublikasikan
5. Pending/loading atau validasi input

## Urutan Implementasi yang Direkomendasikan

1. Buat resolver availability murni dan test matrix.
2. Buat satu query server untuk snapshot effective availability.
3. Buat adapter disabled trigger + tooltip yang accessible.
4. Migrasikan Ulangan dan PPDB terlebih dahulu karena server gate sudah tersedia.
5. Migrasikan child Import Download/Validation/Execution.
6. Migrasikan `masterDataWrite` melalui workspace/shared row-action seam, lalu halaman khusus.
7. Selaraskan Advanced Analytics locked state.
8. Tambahkan source-level atau render tests yang memastikan setiap action child memiliki feedback UI dan backend gate.

## Kriteria Selesai

- Tidak ada child-feature action yang dapat diklik saat effective feature disabled.
- Setiap disabled action memiliki tooltip alasan.
- Kontrol tetap terlihat kecuali ada alasan keamanan untuk menyembunyikannya.
- Keyboard user dapat menemukan alasan disabled.
- Deep link atau request buatan tetap ditolak server.
- Worker tetap memeriksa ulang feature saat eksekusi.
- Satu snapshot availability digunakan oleh seluruh trigger dalam satu halaman.
- Tidak ada query database per tombol.
