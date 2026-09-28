# 03 — Skema Slot Jadwal + preset periode

**What to build:** Skema DB untuk **Slot Jadwal** (jadwal pelajaran mingguan per
Rombongan Belajar) + tabel **periode jam pelajaran** sebagai preset pengisi form, serta
validator murni konflik jadwal. Belum ada UI.

**Blocked by:** None — can start immediately (paralel dengan 02).

**Status:** resolved

## Keputusan yang mengikat (dari tiket 03)

- Slot: `startTime`/`endTime` "HH:MM", `dayOfWeek`, `semester` (`ganjil|genap`),
  `teachingAssignmentId` FK tenant-scoped **wajib**; tanpa kolom ruang; tanpa status
  draf/terbit (langsung berlaku); migration via `drizzle-kit generate`.
- Ikatan Tahun Ajaran mengalir dari penugasan (tanpa kolom tahun di slot); flag
  semester divalidasi terhadap `academic_semester` Tahun Ajaran penugasan saat menyimpan.
- Slot berlaku untuk tanggal *d* hanya bila penugasannya `active` dan mencakup *d*;
  penugasan berakhir → slot tetap ada, tak berlaku, repoint manual.
- Tabel periode jam pelajaran per Tenant: preset pengisi form saja, **bukan dependensi
  runtime** — slot tidak ber-FK ke periode.
- Validator konflik murni (pola `resolveGerbangScheduleDecision`): overlap rentang
  waktu; **Guru dobel** dan **Rombel dobel** keduanya hard ditolak; lingkup
  Tahun Ajaran + Semester; edit mengecualikan slot sendiri.

## Acceptance criteria

- [x] Tabel `teaching_slot` + tabel `teaching_period` (nama final saat implementasi) di
      `db/schema.ts` + migration.
- [x] Validator konflik murni + unit test `tsx --test` (overlap Guru, overlap Rombel,
      tepat bersentuhan tidak konflik, lintas semester tidak konflik).
- [x] Helper "slot berlaku pada tanggal d" + unit test.
- [x] `pnpm typecheck` dan tes fokus hijau.

## Catatan implementasi

- `db/schema.ts`: `teaching_slot` (FK komposit tenant-scoped ke `teaching_assignment`,
  reuse enum `schoolSchedule_day_of_week` + `academicSemester_kind`, check
  `end_time > start_time` dan `version > 0`, index scope) dan `teaching_period`
  (preset, FK tenant, unik label & sortOrder per tenant) — tanpa kolom ruang/tahun,
  tanpa FK slot→periode, sesuai keputusan. Kolom `dayOfWeek` memakai pola camelCase
  yang sama dengan `school_schedule_day` yang sudah ada.
- Migration `drizzle/20260927014506_wandering_bushwacker` (CREATE TABLE saja, additive)
  sudah di-`pnpm db:migrate` ke DB dev.
- `lib/academic/teaching-slot.ts`: modul murni tanpa akses DB — `isValidSlotTime/
  isValidSlotTimeWindow` ("HH:MM" ketat), `slotAppliesOnDate` (aktif +
  `startsOn <= d < endsOn`, tanggal rusak fail-closed), `findTeachingSlotConflicts`
  (overlap setengah-terbuka `[start, end)`, konflik `teacher` + `class-group`,
  `excludeSlotId` untuk edit; kandidat dari caller supaya lingkup Tahun Ajaran
  disimpulkan lewat penugasan masing-masing).
- Test: 10 test `teaching-slot.test.ts` (semua kriteria konflik + keterlakuan) —
  15 pass bersama test domain penugasan. `tsc --noEmit` bersih kecuali 2 error
  pra-eksisting di `*.mysql.test.ts`.
