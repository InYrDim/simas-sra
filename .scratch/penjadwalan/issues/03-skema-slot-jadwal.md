# 03 — Skema Slot Jadwal + preset periode

**What to build:** Skema DB untuk **Slot Jadwal** (jadwal pelajaran mingguan per
Rombongan Belajar) + tabel **periode jam pelajaran** sebagai preset pengisi form, serta
validator murni konflik jadwal. Belum ada UI.

**Blocked by:** None — can start immediately (paralel dengan 02).

**Status:** ready-for-agent

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

- [ ] Tabel `teaching_slot` + tabel `teaching_period` (nama final saat implementasi) di
      `db/schema.ts` + migration.
- [ ] Validator konflik murni + unit test `tsx --test` (overlap Guru, overlap Rombel,
      tepat bersentuhan tidak konflik, lintas semester tidak konflik).
- [ ] Helper "slot berlaku pada tanggal d" + unit test.
- [ ] `pnpm typecheck` dan tes fokus hijau.
