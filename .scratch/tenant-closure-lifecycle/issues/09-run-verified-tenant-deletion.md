# 09 — Jalankan Penghapusan Tenant sampai terverifikasi bersih

**What to build:** Worker ber-lease membersihkan setiap lokasi data aktif nyata melalui adapter idempotent dan verifier independen sampai seluruh checkpoint wajib `verified_clean`. Partial failure aman, tidak di-rollback, dan belum menerbitkan bukti final.

**Blocked by:** 08 — Konfirmasi Penghapusan Tenant secara atomik.

**Status:** ready-for-agent

- [ ] Eksekusi memiliki version, bounded lease, attempt identity, dan checkpoint per lokasi.
- [ ] Checkpoint hanya menggunakan `pending`, `in_progress`, `verification_pending`, `verified_clean`, atau `failed`.
- [ ] Worker stale tidak dapat menulis setelah lease/version digantikan.
- [ ] Setiap cleanup adapter idempotent dan memiliki verifier independen.
- [ ] Hasil uncertain diverifikasi atau diulang dengan aman dan tidak dianggap sukses.
- [ ] Hanya verifier dapat menetapkan `verified_clean`.
- [ ] Boundary MySQL nyata dibersihkan tanpa menghapus identitas yang memiliki hubungan independen.
- [ ] Tenant-only user, role, credential, session, configuration, payload, export, dan reference dibersihkan.
- [ ] Tidak ada dangling foreign key atau tombstone yang dapat merekonstruksi Tenant.
- [ ] Checkpoint sukses dilewati pada retry kecuali perlu reverification.
- [ ] Kondisi siap finalisasi ditolak bila lokasi wajib belum bersih, step berjalan, atau fence tidak aktif.
- [ ] Test fake adapter mencakup sukses, timeout, unknown result, verification failure, dan data muncul kembali.
