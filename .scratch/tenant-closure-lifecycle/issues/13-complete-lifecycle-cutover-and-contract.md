# 13 — Selesaikan cutover dan contract migration lifecycle

**What to build:** Selesaikan rollout `expand → backfill → verify → activate → contract` setelah seluruh reader, writer, worker, export, billing, dan restore control terbukti aman. Hentikan compatibility mode tanpa membuka Tenant tertutup atau membalik keputusan lifecycle.

**Blocked by:** 03 — Batalkan atau kedaluwarsakan pengajuan Penutupan Tenant; 06 — Buka kembali Tenant dengan subscription baru; 07 — Hasilkan dan unduh Paket Ekspor Tenant; 10 — Lanjutkan Penghapusan Tenant yang gagal; 12 — Cegah data Tenant terhapus hidup kembali dari backup.

**Status:** ready-for-agent

- [ ] Semua Tenant memiliki state/configuration valid atau reconciliation case eksplisit.
- [ ] Seluruh batch backfill selesai dan shadow access differences diselesaikan.
- [ ] Mutation lifecycle diaktifkan bertahap melalui feature flag dan memiliki observability.
- [ ] Semua writer lama yang dapat melewati status operasional atau fence dihentikan.
- [ ] Compatibility writing dipertahankan setidaknya 14 hari setelah cutover.
- [ ] Legacy fields menjadi read-only setelah observation window berhasil.
- [ ] Struktur lama dihapus pada deployment terpisah setelah setidaknya 14 hari tambahan.
- [ ] Rollback deployment hanya mematikan mutation baru dan tidak membuka Tenant, membalik backfill, menghapus fence, atau menghentikan deletion.
- [ ] Adapter observation, concurrency tests, export cleanup, billing coordination, dan restore suppression menjadi cutover gates.
- [ ] Audit cutover membuktikan tidak ada synthetic case, deadline, atau Tenant closed akibat migrasi.
- [ ] Versi aplikasi dalam compatibility window memahami status `closed` secara aman.
