# 02 — Penugasan Mengajar: halaman Master Data

**What to build:** Submenu baru di Master Data untuk mengelola **Penugasan Mengajar**
(Guru + Mata Pelajaran + Rombongan Belajar + Tahun Ajaran) dengan full lifecycle,
memakai modul domain existing `lib/academic/teaching-assignment.ts` — bukan logika baru.

**Blocked by:** None — can start immediately (paralel dengan 03).

**Status:** resolved

## Keputusan yang mengikat (dari tiket 05)

- Lokasi: Master Data (submenu baru), **tanpa feature gate** — RBAC School Admin saja;
  Ulangan tetap terlayani meski fitur Penjadwalan dimatikan Provider.
- Full lifecycle di UI: buat (`planned`) → Aktifkan → Akhiri / Batalkan / Ganti Guru
  (replace); semua transisi wajib alasan dan tercatat di `teaching_assignment_event`.
- Kewenangan tulis: hanya School Admin (permission tulis baru). Guru hanya konsumen
  (baca penugasannya sendiri sudah ada lewat `listEffectiveTeachingAssignmentsForUser`).
- Impor massal ditunda — tidak di tiket ini.

## Acceptance criteria

- [x] Submenu Master Data baru + halaman list penugasan (filter status + Tahun Ajaran;
      daftar menampilkan Guru/Mapel/Rombel/periode/status).
- [x] Form buat (planned) + aksi Aktifkan / Ubah Rencana / Batalkan / Akhiri / Ganti
      Guru (replace), semua dengan form alasan wajib.
- [x] Riwayat event penugasan tampil per penugasan terpilih.
- [x] Operasi + permission tulis baru (School Admin) masuk rbac contract + coverage:
      seed `teaching-assignments.teaching.view/update`, operasi
      `teaching-assignments.load` (page) + `.write` (6 action, gate write).
- [x] Loader pada semua aksi yang menunggu proses (`ValidatedSubmitButton` memakai
      `useFormStatus` → disabled saat pending, pola Master Data existing).
- [x] `pnpm typecheck` bersih, tes fokus 347 pass + test domain penugasan 5 pass,
      `pnpm rbac:coverage` hijau (202/202, issues kosong).

## Comments

### 2026-09-27 — implementasi

- **Nol logika domain baru** — 6 server action (`master/penugasan/actions.ts`) hanya
  mem-parse form lalu memanggil `createTeachingAssignmentService` existing (create,
  updatePlanned, activate, end, cancel, replace). Semua aturan overlap, endpoint,
  lifecycle, versi, dan audit event tetap milik domain.
- Halaman server (`page.tsx`) + loader (`data.ts`): list + filter status/tahun,
  panel detail, dialog aksi lifecycle (`PenugasanDialog`, ikon lucide per aksi),
  riwayat event `teaching_assignment_event` per penugasan terpilih. Pola mengikuti
  `master/organisasi` (helper Field/Select/Hidden, `finishMasterDataAction` diarahkan
  ke `?result=` + `?selected=`; section `"penugasan"` ditambahkan ke union
  `action-result.ts`).
- Kode hasil diterjemahkan ke pesan Indonesia (`result-codes.ts`), termasuk
  `overlap`/`invalid-endpoint`/`conflict`/`read-only`.
- RBAC: dua permission tenant-assignable + dua operasi `school-admin-only`; menu
  Master Data mendapat item "Penugasan Mengajar" (`teaching-assignments.teaching.view`).
- Tidak digate feature (sesuai keputusan tiket 05): cukup RBAC — Ulangan tetap
  terlayani meski fitur Penjadwalan dimatikan Provider.
- Catatan keamanan: semua action mengevaluasi ulang otorisasi server-side via
  `enforceTenantMasterDataOperation` (tidak percaya klien), store domain
  tenant-qualified + `FOR UPDATE` scope lock bawaan; input FormData selalu
  di-parse/trim/Number-checked sebelum masuk service; tidak ada SQL manual — semua
  via Drizzle parameterized.
-Catatan: tanpa seed role bawaan baru — School Admin memperoleh akses via
  school-admin authority; role kustom bisa diberi permission baru tersebut.
