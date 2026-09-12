# 03 — Perekaman Kelas (Manual)

Type: task
Status: ready-for-agent
Blocked by: 01

## Brief

Implementasikan perekaman Kelas mode Manual: catat status hadir/izin/sakit/alpa per siswa
per sesi kelas. Halaman `absensi/kelas/page.tsx` placeholder diganti UI rekam + tampilan hari ini.

## Acceptance

- Action server `recordKelasAction(domain, formData)` di `absensi/actions.ts`:
  - `enforceTenantOperation(domain, "absensi.kelas.record")`
  - validasi `studentId` milik Tenant aktif, `status` ∈ {hadir, izin, sakit, alpa}
  - tulis `attendance_record` (layer=kelas, mode=manual)
- UI: pilih siswa, pilih status (4 opsi), tombol simpan, loader saat submit.
- Tampilan hari ini: daftar rekam Kelas hari ini untuk Tenant.
- Feature-gate: tolak jika `absensiKelas` nonaktif.
- Unit test (pure) + MySQL test untuk write & tenant-isolation.

## Comments
