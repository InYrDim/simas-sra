# 09 — Siapkan migrasi aman untuk identitas Pemohon

**What to build:** Operator dapat mengaudit data lama dan memasang fondasi schema additive untuk identitas Pemohon, ikatan sekolah, kepemilikan Pengajuan, nomor percobaan, serta idempotency tanpa memutus flow produksi existing. Migrasi harus berhenti dengan laporan yang dapat ditindaklanjuti ketika data tidak dapat dipetakan secara aman dan tidak boleh menebak pemilik dari snapshot kontak.

**Blocked by:** None — can start immediately.

**Status:** resolved

- [x] Audit melaporkan Pengajuan tanpa pemilik terverifikasi, NPSN nonkanonis atau duplikat, lebih dari satu pending per sekolah, identity path yang nol atau ganda, School Admin tanpa relasi Tenant yang sah, dan relasi approval–Tenant yang tidak konsisten.
- [x] Pengajuan tanpa pemilik tidak dipetakan otomatis menggunakan email atau data snapshot; audit berhenti gagal dan mencantumkan identifier yang memerlukan rekonsiliasi Provider.
- [x] Schema additive dapat merepresentasikan Pemohon sejak registrasi, ikatan unik user–NPSN kanonis, owner Pengajuan, binding, attempt number, idempotency key, dan payload hash tanpa mewajibkan reader existing langsung berpindah.
- [x] Struktur baru pada fase expand tetap kompatibel dengan aplikasi existing selama rollout bertahap.
- [x] Backfill hanya menerima mapping kepemilikan eksplisit yang tervalidasi dan dapat dijalankan ulang dengan aman.
- [x] Fixture migrasi membuktikan data bersih dapat di-expand dan data bermasalah ditolak dengan laporan deterministik.
- [x] Baseline jumlah dan timestamp record aktivasi School Admin dicatat untuk verifikasi migrasi berikutnya.
- [x] Test, typecheck, lint, dan build existing tetap lulus setelah fase expand.

## Comments

Implemented the additive Drizzle expand migration, deterministic audit and activation baseline, explicit transactional ownership backfill, fixture tests, and operator runbook. Validation includes the full automated suite and an isolated MySQL 8.4 expand/audit/backfill/rerun exercise.
