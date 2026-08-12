# Absensi — Fase 2: Perekaman Manual (Gerbang + Kelas)

## Context

Fase 1 (sudah selesai & ter-commit di branch `absensi`) membangun **fondasi konfigurasi** fitur
Absensi dengan desain THREE-TIER:

1. Provider membatasi mode (Manual/QR/Kartu) dan lapisan (Gerbang/Kelas) yang diizinkan per Tenant.
2. School Admin mengaktifkan lapisan dan mengikat satu mode yang diizinkan ke tiap lapisan.
3. Konfigurasi disimpan di `tenant.settings` (JSON), tanpa migrasi DB.

Fase 1 **belum** merekam kehadiran sungguhan — halaman Gerbang/Kelas baru placeholder, dan
belum ada data model perekaman. Fase 2 mengisi inti fitur: **perekaman Manual** untuk kedua
lapisan, karena mode Manual selalu tersedia (tidak butuh hardware) dan menjadi fondasi bagi
mode QR/Kartu di Fase 3.

Subjek kehadiran adalah **Siswa** (`student_profile`).

## Goals (Fase 2)

- Data model perekaman absensi (`attendance_record`) dengan isolasi Tenant ketat.
- Perekaman **Gerbang**: catat masuk/keluar siswa (tap/Manual) per hari.
- Perekaman **Kelas**: catat status hadir/izin/sakit/alpa per siswa per sesi kelas.
- Tampilan "hari ini" untuk masing-masing lapisan.
- Enforcement RBAC & feature-gate yang konsisten dengan Fase 1.

## Non-goals (Fase 2)

- Mode QR & Kartu (Fase 3).
- Pelaporan/rekap agregat (Fase 4 — issue terpisah).
- Penarikan data siswa otomatis dari jadwal kelas (manual pilih siswa dulu).

## Data model (sketch)

`attendance_record` (mysqlTable):
- `id` varchar(36) PK
- `tenantId` varchar(36) NOT NULL → tenant.id
- `studentId` varchar(36) NOT NULL → student_profile(tenantId, id)
- `layer` enum("gerbang","kelas") NOT NULL
- `mode` enum("manual","qr","kartu") NOT NULL
- `recordedAt` timestamp(3) NOT NULL
- `status` enum tergantung lapisan:
  - gerbang: "masuk" | "keluar"
  - kelas: "hadir" | "izin" | "sakit" | "alpa"
- `recordedByUserId` varchar(36) NOT NULL → user(tenantId, id)
- `notes` varchar(500) nullable
- `createdAt`, `updatedAt`, `version`
- unique / index: (tenantId, studentId, layer, recordedAt) untuk lookup harian
- FK + check sesuai konvensi schema (`student_profile_tenant_student_fkey`, `version > 0`, dst)

> Catatan: `status` mungkin perlu tabel terpisah atau kolom dengan check yang membedakan
> lapisan. Detail diputuskan di issue `02` (data model).

## RBAC / gating

- Operasi rekam Gerbang: `absensi.gerbang.record` (permission `absensi.gerbang.record`)
- Operasi rekam Kelas: `absensi.kelas.record` (permission `absensi.kelas.record`)
- Keduanya `requires: ["absensiGerbang"]` / `["absensiKelas"]` di `tenant-features.ts`
- School Admin otomatis mendapat permission (active operation).
- Entry point halaman & action dipetakan di `tenant-rbac-contract.ts` (legacy `["entitlement"]`
  untuk page yang pakai `enforceTenantFeatureAccess`).

## Conventions repo

- Migration: `pnpm db:generate` (drizzle-kit) → snapshot di `monorepo/drizzle/`.
- Test: `node:test` + `tsx --test`; unit murni di `lib/attendance/`, MySQL test `*.mysql.test.ts`.
- Server-only module: `import "server-only"`.
- Issue lokal: `.scratch/absensi/issues/NN-<slug>.md`, `Status:` line di atas.

## Out of scope tracking

- Fase 3: Mode QR (`absensi.qr.record`), Mode Kartu (`absensi.kartu.record`)
- Fase 4: Pelaporan/rekap (`absensi.report.view`)
