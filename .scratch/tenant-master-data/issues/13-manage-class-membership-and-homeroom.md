# 13 — Kelola anggota Rombel dan Wali Kelas

**What to build:** Tambahkan effective-dated membership Siswa dan assignment Wali Kelas ke Rombongan Belajar dengan transfer atomik dan history yang tidak ditimpa.

**Blocked by:** 08 — Kelola lifecycle dan archive Siswa; 09 — Kelola Profil Guru; 12 — Kelola Rombongan Belajar dasar.

**Status:** resolved

- [x] School Admin dapat menambah Siswa aktif ke Rombel yang valid.
- [x] Satu Siswa maksimal memiliki satu membership aktif pada satu waktu.
- [x] Satu planned membership diperbolehkan untuk Tahun Ajaran Draft tanpa menutup current membership.
- [x] Transfer menutup membership lama dan membuka membership baru pada effective date yang sama dalam satu transaksi.
- [x] Promotion tidak terjadi otomatis.
- [x] School Admin dapat menetapkan atau mengganti Guru aktif sebagai Wali Kelas.
- [x] Satu Rombel maksimal memiliki satu Wali Kelas aktif dan satu Guru maksimal satu Rombel dalam Tahun Ajaran yang sama.
- [x] Wali Kelas tidak membuat subject-teaching assignment.
- [x] Membership dan assignment histories tampil di detail dan menjadi archive blockers yang sesuai.
- [x] MySQL concurrency tests membuktikan tidak ada double membership atau double Wali Kelas.

## Answer

Implemented Tenant-isolated, effective-dated Keanggotaan Rombongan Belajar and Wali Kelas management with explicit add, transfer, assignment, and replacement commands. Transfers and replacements close prior rows and append new rows atomically; current and Draft-year planned membership slots are independent, histories remain append-preserved, promotion remains explicit, and no subject-teaching assignment is created.

Added an additive Drizzle/MySQL migration with composite Tenant ownership, generated open-slot uniqueness constraints, transaction row locking, relationship audit events, Rombel/Siswa/Guru archive blockers, and detail history/actions. TDD, full 221-test validation, real-MySQL concurrent claims/replacements, typecheck, lint, and diff checks passed. Review found no remaining ticket-scope or standards blockers.
