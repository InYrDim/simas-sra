# 02 — Perekaman Gerbang (Manual)

Type: task
Status: ready-for-agent
Blocked by: 01

## Brief

Implementasikan perekaman Gerbang mode Manual: catat masuk/keluar siswa per hari.
Halaman `app/(tenant)/[domain]/(authenticated)/absensi/gerbang/page.tsx` yang sekarang
placeholder diganti UI rekam + tampilan "hari ini".

## Acceptance

- Action server `recordGerbangAction(domain, formData)` di `absensi/actions.ts`:
  - `enforceTenantOperation(domain, "absensi.gerbang.record")`
  - validasi `studentId` milik Tenant aktif, `status` ∈ {masuk, keluar}
  - tulis `attendance_record` (layer=gerbang, mode=manual)
- UI: pilih siswa (dari `student_profile` aktif Tenant), tombol Masuk/Keluar, loader saat submit.
- Tampilan hari ini: daftar rekam Gerbang hari ini untuk Tenant.
- Feature-gate: halaman & action menolak jika `absensiGerbang` nonaktif (sudah ada
  `enforceTenantFeatureAccess`).
- Unit test (pure) + MySQL test (`*.mysql.test.ts`) untuk write & tenant-isolation.

## Comments
