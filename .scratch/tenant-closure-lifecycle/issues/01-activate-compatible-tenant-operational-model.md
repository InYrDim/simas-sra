# 01 — Aktifkan model operasional Tenant secara kompatibel

**What to build:** Perkenalkan status operasional `active | closed`, konfigurasi Masa Tunggu Penghapusan, dan penanda rekonsiliasi melalui rollout aditif. Tenant yang sudah ada tetap beroperasi, data ambigu tidak memperoleh kewenangan lifecycle destruktif, dan event lifecycle berulang dapat dicatat tanpa collision.

**Blocked by:** None — can start immediately.

**Status:** resolved

- [x] Schema baru bersifat aditif dan tetap kompatibel selama masa transisi.
- [x] Tenant existing yang usable dibackfill menjadi `active` tanpa membuat Kasus Penutupan Tenant atau jadwal penghapusan.
- [x] Data legacy ambigu menghasilkan `needs_reconciliation`, tetap operasional, tetapi mutation lifecycle destruktif ditolak secara fail-closed.
- [x] Backfill berjalan per batch, idempotent, resumable, dan memiliki checkpoint serta observability.
- [x] Shadow verification membandingkan keputusan akses lama dan baru sebelum aktivasi.
- [x] Tenant aktif yang telah dimigrasikan tetap dapat login, membuka dashboard, dan menjalankan tindakan existing.
- [x] Identitas outbox membedakan kasus, transisi, eksekusi, atau attempt sehingga event sejenis tidak collision.
- [x] Feature flag dapat menghentikan mutation lifecycle baru tanpa membalikkan hasil backfill.
- [x] Test membuktikan compatibility, rerun backfill, data ambigu, dan akses Tenant existing.

## Answer

Model operasional Tenant telah diekspansi secara kompatibel dengan backfill batch yang resumable, checkpoint dan metrik observability, shadow verification sebagai cutover gate, penanda rekonsiliasi fail-closed, default Masa Tunggu Penghapusan, feature flag mutation, serta identitas outbox yang scoped. Tenant baru dan Tenant legacy usable tetap aktif tanpa membuat kasus atau jadwal penghapusan sintetis.
