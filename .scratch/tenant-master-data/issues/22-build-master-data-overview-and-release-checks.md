# 22 — Sediakan overview Master Data dan release checks

**What to build:** Buat `/master` sebagai ringkasan tindakan lintas-entitas dan sediakan bukti otomatis/manual yang diperlukan sebelum feature flags diperluas ke Tenant lain.

**Blocked by:** 04 — Kelola logo dan riwayat akreditasi sekolah; 05 — Kelola Tahun Ajaran dan Semester; 06 — Kelola katalog Mata Pelajaran; 11 — Kelola Warga Sekolah yang memiliki beberapa profil; 13 — Kelola anggota Rombel dan Wali Kelas; 14 — Tambahkan Kepala Sekolah ke Profil Sekolah; 16 — Kelola Aset dan riwayat inventaris; 17 — Kelola Organisasi Siswa; 18 — Kelola Ekstrakurikuler dan Kelompok Kegiatan; 21 — Eksekusi dan laporkan hasil impor.

**Status:** ready-for-agent

- [ ] `/master` hanya tersedia untuk authorized School Admin dan mengikuti read-only Tenant state.
- [ ] Overview menampilkan authoritative aggregate counts, actionable exceptions, recent safe audit activity, dan quick actions.
- [ ] Setiap card/exception menuju URL-backed filtered entity view yang menghasilkan record yang sama dengan count.
- [ ] Overview tidak membuat generic health score atau lifecycle transition otomatis.
- [ ] Recent activity tidak menampilkan sensitive before/after payload.
- [ ] Reconciliation command mendeteksi missing/unknown Tenant, cross-Tenant relationship, duplicate identifier, overlapping period, invalid active state, archive misuse, missing audit/history, import mismatch/double-success, accidental account creation, dan overview count drift.
- [ ] Reconciliation bersifat read-only, menghasilkan safe identifiers/counts, dan gagal non-zero ketika invariant rusak.
- [ ] Playwright critical suite membuktikan authorization, cross-Tenant denial, create/edit/conflict, archive/reactivation, mobile list/detail, academic relationship, dan complete import flow terhadap dua Tenant.
- [ ] Read/write/import feature flags, worker emergency stop, application rollback, backup restore drill, dan targeted repair dry-run memiliki runbook serta verification evidence.
- [ ] Internal/demo, Tenant pilot, import pilot, small cohort, dan general activation memakai completed evidence tanpa minimum hari.
- [ ] Cross-Tenant access, unauthorized mutation, corrupted history, import double-commit, destructive migration, duplicate identity, atau unreconciled loss menjadi immediate stop condition.
