# 02 — Ajukan dan putuskan Penutupan Tenant

**What to build:** School Admin dapat mengajukan Penutupan Tenant, sedangkan Provider Admin dapat menyetujui, menolak, atau memulai penutupan langsung. Persetujuan menutup Tenant, menyimpan snapshot tenggat, menghentikan biaya layanan baru, menulis audit, dan menerbitkan outbox secara atomik.

**Blocked by:** 01 — Aktifkan model operasional Tenant secara kompatibel.

**Status:** ready-for-agent

- [ ] School Admin aktif dapat mengajukan penutupan dengan alasan dan autentikasi ulang.
- [ ] Tenant tetap `active` selama kasus `pending_closure_review`.
- [ ] Pengajuan berulang atau concurrent mengembalikan satu kasus aktif yang sama.
- [ ] Provider Admin dapat menyetujui dengan masa tunggu 1–365 hari, default 30 hari, atau menolak dengan alasan.
- [ ] Provider Admin dapat menutup Tenant langsung dengan alasan dan autentikasi ulang.
- [ ] Penutupan atomik mengubah Tenant menjadi `closed`, menyimpan snapshot waktu/zona/deadline/aktor, menonaktifkan subscription, menulis audit, dan menerbitkan outbox.
- [ ] Deadline dihitung sebagai hari kalender pada local wall-clock Tenant dan disimpan sebagai timestamp absolut.
- [ ] Kegagalan audit, billing coordination, atau outbox membatalkan seluruh mutation lokal.
- [ ] Otorisasi memakai role, hubungan Tenant, status akun, dan sesi terkini.
- [ ] UI School Admin dan Provider memisahkan status operasional dari status kasus serta menangani stale conflict.
- [ ] Test command dan MySQL membuktikan state transition, idempotency, rollback, locking, dan concurrency.
