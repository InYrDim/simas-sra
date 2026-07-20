# 01 — Aktifkan model operasional Tenant secara kompatibel

**What to build:** Perkenalkan status operasional `active | closed`, konfigurasi Masa Tunggu Penghapusan, dan penanda rekonsiliasi melalui rollout aditif. Tenant yang sudah ada tetap beroperasi, data ambigu tidak memperoleh kewenangan lifecycle destruktif, dan event lifecycle berulang dapat dicatat tanpa collision.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Schema baru bersifat aditif dan tetap kompatibel selama masa transisi.
- [ ] Tenant existing yang usable dibackfill menjadi `active` tanpa membuat Kasus Penutupan Tenant atau jadwal penghapusan.
- [ ] Data legacy ambigu menghasilkan `needs_reconciliation`, tetap operasional, tetapi mutation lifecycle destruktif ditolak secara fail-closed.
- [ ] Backfill berjalan per batch, idempotent, resumable, dan memiliki checkpoint serta observability.
- [ ] Shadow verification membandingkan keputusan akses lama dan baru sebelum aktivasi.
- [ ] Tenant aktif yang telah dimigrasikan tetap dapat login, membuka dashboard, dan menjalankan tindakan existing.
- [ ] Identitas outbox membedakan kasus, transisi, eksekusi, atau attempt sehingga event sejenis tidak collision.
- [ ] Feature flag dapat menghentikan mutation lifecycle baru tanpa membalikkan hasil backfill.
- [ ] Test membuktikan compatibility, rerun backfill, data ambigu, dan akses Tenant existing.
