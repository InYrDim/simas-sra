# 01 — Data model `attendance_record`

Type: task
Status: ready-for-agent
Blocked by:

## Brief

Buat tabel `attendance_record` di `monorepo/db/schema.ts` untuk merekam kehadiran siswa,
dengan isolasi Tenant ketat dan konvensi schema yang sama dengan `student_profile`.

## Acceptance

- Kolom: `id`, `tenantId`, `studentId`, `layer` (enum gerbang/kelas), `mode` (enum manual/qr/kartu),
  `recordedAt`, `status`, `recordedByUserId`, `notes`, `createdAt`, `updatedAt`, `version`.
- FK: `tenantId → tenant.id`, `(tenantId, studentId) → student_profile`, `(tenantId, recordedByUserId) → user`.
- Check: `version > 0`; `status` valid sesuai `layer` (lihat diskusi di body).
- Index/unique untuk lookup harian: `(tenantId, studentId, layer, recordedAt)`.
- Migration dihasilkan via `pnpm db:generate` dan snapshot masuk `monorepo/drizzle/`.
- `tsx --test` unit test untuk guard/validasi status (pure module di `lib/attendance/`).

## Open question (jawab sebelum kode)

Apakah `status` satu kolom enum dengan 6 nilai (`masuk|keluar|hadir|izin|sakit|alpa`) + check
membatasi kombinasi `layer`/`status`, atau dua tabel/dua enum terpisah? Rekomendasi: satu enum
6-nilai + check `((layer='gerbang' AND status IN ('masuk','keluar')) OR (layer='kelas' AND status IN ('hadir','izin','sakit','alpa')))`.

## Comments
