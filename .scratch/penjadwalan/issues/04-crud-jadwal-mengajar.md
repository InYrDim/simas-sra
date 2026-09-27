# 04 — CRUD Jadwal Mengajar (Slot)

**What to build:** Halaman `/jadwal/mengajar` yang sesungguhnya: School Admin menyusun
Slot Jadwal per Rombongan Belajar (buat/edit/hapus) dengan cek konflik dan pemilihan
Penugasan Mengajar aktif. Membuat feature key `penjadwalanWrite` di registry — satu-
satunya tempat yang boleh membuatnya, sesuai catatan tiket 01.

**Blocked by:** 01, 02, 03

**Status:** resolved

## Keputusan yang mengikat (dari tiket 03 + 05)

- Form slot memilih **satu Penugasan Mengajar aktif** (filter rombel/tahun/semester) +
  **tautan ke Master Data** untuk membuat baru; tidak ada pembuatan penugasan dari form.
- Konflik Guru/Rombel hard ditolak dengan pesan konflik (pakai validator slice 03).
- Slot yang sudah punya sesi **diblokir dari penghapusan** (tiket 04) — di slice ini
  belum ada sesi, tapi guard-nya dipasang sejak sekarang.
- Hanya School Admin; ganti permission menu dari placeholder ke `jadwal.mengajar.load`.
- Preset periode jam pelajaran (slice 03) dipakai mengisi jam form secara cepat.

## Acceptance criteria

- [x] Halaman `/jadwal/mengajar`: pilih Rombongan Belajar → grid mingguan slot; buat/
      edit/hapus slot dengan loader.
- [x] Pemilih Penugasan Mengajar aktif + link ke Master Data.
- [x] Simpan menolak konflik dengan pesan yang menyebut pelajaran/Guru yang bentrok.
- [x] Feature key `penjadwalanWrite` dibuat + dipakai operasi tulis; enforcement server.
- [x] Menu + halaman terkunci (non-disclosure) bila Provider mematikan Penjadwalan.
- [x] Tes: konflik ditolak di layer tulis; gate write; role tanpa `penjadwalanWrite`
      ditolak.
- [x] `pnpm typecheck`, tes fokus, `pnpm rbac:coverage` hijau.

## Catatan implementasi

- **Registry**: `penjadwalanWrite` (requires penjadwalan + penjadwalanRead, routes
  `/jadwal/mengajar`) — **opt-in** (legacy default `false`, berbeda dari parent/Read
  yang ditegakkan aktif untuk tenant lama); test policy + fixture provider diperbarui.
- **RBAC**: permission `jadwal.mengajar.update` (registry 170→171); operasi
  `jadwal.mengajar.write` (gate `write`, `school-admin-only`, 5 entry point action).
  School Admin otomatis mendapat permission ini lewat alur otoritas admin.
- **Service** `lib/academic/teaching-slot-service.ts`: murni + store diinjeksi —
  create/update/delete slot, preset periode, validasi penugasan aktif, kesesuaian
  semester terhadap `academic_semester` aktif, konflik via validator slice 03
  (`conflicts` disertakan di hasil gagal), optimistic versioning, **guard hapus
  slot ber-sesi** (`sessionCountsBySlotId`; implementasi store jujur menyatakan
  kolom `slot_id` hadir di slice 05 — guard terpasang dan teruji di seam service).
- **Actions** `jadwal/actions.ts`: setiap aksi recheck fitur `penjadwalanWrite`
  (`enforceTenantFeatureEnabled`) + operasi `jadwal.mengajar.write` di server;
  file bebas marker `enforceTenantFeatureAccess` agar coverage checker tidak
  salah label (pelajaran rbac-coverage).
- **UI**: pemilih rombel, grid Senin–Sabtu, dialog buat/edit/hapus (loader
  `ValidatedSubmitButton`), quick-fill preset periode, badge semester aktif,
  pesan hasil Indonesia (termasuk `conflict`, `slot-in-use`, `version-conflict`).
- **Verifikasi**: tsc bersih (2 error mysql pra-eksisting), test fokus 70+ hijau,
  `pnpm test:unit` 1051/1064 — 13 kegagalan diverifikasi pra-eksisting via stash
  baseline (file migration drizzle hilang di disk + 2 test UI tenant template),
  `rbac:coverage` 207/207, `git diff --check` bersih.
