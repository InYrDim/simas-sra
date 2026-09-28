# 01 — Petakan 22 entry point yang tidak ter-coverage

**What to build:** Petakan seluruh entry point yang dilaporkan `pnpm rbac:coverage`
ke operation map (`lib/authorization/tenant-rbac-contract.ts`) dengan permission,
gate, classification, dan context yang **jujur** per entry point — bukan asal
menempelkan permission apa pun agar hijau. Hingga `pnpm rbac:coverage` keluar exit 0.

**Blocked by:** None — can start immediately.

**Status:** resolved

## Daftar temuan (2026-09-27)

**21 × `unmapped-entry-point`:**

- `action:absensi/actions.ts#saveModeSettingsAction`
- `action:absensi/settings/schedule/actions.ts#importGerbangScheduleAction`
- `action:absensi/settings/schedule/actions.ts#loadGerbangScheduleAction`
- `action:absensi/settings/schedule/actions.ts#saveGerbangScheduleAction`
- `action:integrasi/whatsapp/actions.ts#completeWhatsAppBotSelfServiceAction`
- `action:integrasi/whatsapp/actions.ts#readWhatsAppBotSelfServiceStatusAction`
- `action:integrasi/whatsapp/actions.ts#readWhatsAppBotSessionStatusAction`
- `action:integrasi/whatsapp/actions.ts#refreshWhatsAppBotSelfServiceQrAction`
- `action:integrasi/whatsapp/actions.ts#startWhatsAppBotSelfServiceAction`
- `action:integrasi/whatsapp/actions.ts#submitWhatsAppBotRequestAction`
- `action:master/import/actions.ts#cleanDemoMasterDataAction`
- `action:master/siswa/actions.ts#deleteStudentGuardianAction`
- `action:master/siswa/actions.ts#saveStudentGuardianAction`
- `action:settings/roles/actions.ts#createRoleFromTemplate`
- `action:settings/roles/actions.ts#updateRoleFromTemplate`
- `page:absensi/settings/layers/page.tsx`
- `page:absensi/settings/modes/[mode]/page.tsx`
- `page:absensi/settings/modes/page.tsx`
- `page:absensi/settings/schedule/page.tsx`
- `page:kelas/page.tsx`
- `page:scan/absensi/[sessionId]/page.tsx`
- `page:settings/roles/templates/page.tsx`

**1 × `undeclared-authority-decision`:**

- `page:scan/absensi/[sessionId]/page.tsx` — marker `entitlement` tanpa deklarasi
  entitlement yang sesuai di operasinya.

## Panduan pemetaan per grup (periksa dulu, jangan asal tempel)

- **absensi/settings/modes, layers, schedule + saveModeSettingsAction** — halaman
  pengaturan Absensi; kandidat permission existing (`absensi.settings.update`,
  `absensi.gerbang.manage`, dsb.) sesuai isi halaman/aksi. Grup schedule
  (`schedule/page.tsx` + 3 action) **sedang direlokasi ke Penjadwalan** (slice 07,
  `.scratch/penjadwalan/issues/07-relokasi-jadwal-sekolah.md`) dan akan memakai
  operasi baru `jadwal.sekolah.*` di path baru — petakan di lokasi baru saja agar
  tidak kerja dobel, atau koordinasikan dengan slice 07.
- **integrasi/whatsapp (6 action self-service/bot)** — sudah ada operasi
  `integrasi.whatsapp-bot.*`; tambahkan entry point yang hilang ke operasi yang
  tepat, atau buat operasi baru bila semantiknya beda (mis. self-service vs bot).
- **master/siswa guardian (2 action) + kelas/page.tsx** — hubungan wali siswa dan
  halaman kelas; periksa permission master data yang berlaku.
- **master/import cleanDemoMasterDataAction** — aksi destruktif demo; kemungkinan
  butuh permission khusus + gate write + risk tinggi.
- **settings/roles createRoleFromTemplate / updateRoleFromTemplate /
  templates/page.tsx** — pembuatan role dari Template Role Tenant; ada permission
  roles existing (`tenant.roles.*`); periksa gate write dan risk.
- **scan/absensi/[sessionId]/page.tsx** — halaman scan QR (diakses operator, bukan
  admin); ada operasi `absensi.qr.record` yang memuat path scan; periksa mengapa
  halamannya sendiri tidak terpetakan + perbaiki deklarasi entitlement-nya.

## Acceptance criteria

- [x] Semua entry point di atas terpetakan di operation map dengan permission/gate/
      classification/context yang benar per grup (semuanya ke operasi yang memang
      sedang dia enforce — tidak ada permission placeholder baru).
- [x] Temuan `undeclared-authority-decision` di halaman scan hilang dengan cara yang
      jujur: operasi `absensi.qr.record` kini mendeklarasikan `legacy: ["entitlement"]`
      DAN `recordQrAction` benar-benar mengecek fitur di server (recheck baru), jadi
      deklarasi marker mencerminkan keputusan otoritas yang nyata.
- [x] Grup `absensi/settings/schedule` dipetakan ke operasi guard nyatanya hari ini
      (`absensi.settings.save`); slice 07 tinggal memindahkan 3 baris entry point ke
      operasi `jadwal.sekolah.*` saat relokasi.
- [x] Tidak ada regresi permission: tidak ada operasi yang kehilangan/mengubah
      permission; hanya entry point dan deklarasi marker yang ditambah.
- [x] `pnpm rbac:coverage` exit 0 tanpa issue (195/195 mapped).
- [x] `pnpm typecheck` tanpa error baru; 366 test otorisasi/feature/menu hijau.

## Comments

### 2026-09-27 — implementasi

- `lib/authorization/tenant-rbac-contract.ts`: tambah entry point ke operasi yang
  sudah ada:
  - `absensi.settings.save` ← `saveModeSettingsAction`, 3 action Gerbang schedule,
    halaman `absensi/settings` (layers, modes, modes/[mode], schedule).
  - `integrasi.whatsapp-bot.update` ← submit/start/complete self-service;
    `integrasi.whatsapp-bot.load` ← refresh QR + 2 read status (sesuai
    `enforceTenantOperation` yang dipanggil masing-masing).
  - `students.update` ← save/delete guardian (permission `students.students.update`);
    `people-imports.execute` ← `cleanDemoMasterDataAction` (critical, MD).
  - `class-groups.load` ← halaman `/kelas`; `tenant.roles.list` ← halaman templates;
    `tenant.roles.update` ← create/update role from template.
- **`OPERATION_MAP_VERSION` naik `@4` → `@5`** (bentuk map berubah; digest backfill
  ikut). Test yang mematok literal versi diselaraskan (5 file + people-import
  seeds `@4` → `@5` di 2 test MySQL).
- `absensi.qr.record` deklarasikan `legacy: ["entitlement"]` + recheck fitur baru:
  helper `lib/attendance/absensi-qr-feature.ts` dipanggil `recordQrAction`. Helper
  dipisah file karena checker mendeteksi marker **per file** — inline di
  `absensi/actions.ts` akan salah melabeli semua action absensi sebagai
  `entitlement` (sudah dicoba dan terbukti, lalu dibatalkan).
- Test baru: daftar 22 entry point wajib tetap terpetakan (guard regresi).
- Catatan: `proxy.test.ts` gagal karena file migration drizzle hilang di disk —
  pra-eksisting, diverifikasi identik di baseline `git stash`.
