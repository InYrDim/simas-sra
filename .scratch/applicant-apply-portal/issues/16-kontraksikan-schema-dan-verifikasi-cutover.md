# 16 — Kontraksikan schema dan verifikasi cutover

**What to build:** Operator dapat menyelesaikan backfill, mengaktifkan seluruh constraint final, menghapus kontrak legacy, dan melakukan cutover portal Pemohon dengan bukti audit, migrasi, concurrency, browser journey, serta build produksi yang lengkap. Rollback dan forward-fix mempunyai batas operasional yang jelas.

**Blocked by:** 12 — Kirim Pengajuan pertama dan pantau status pending; 13 — Tolak dan ajukan ulang Pengajuan SIMAS; 14 — Promosikan Pemohon melalui approval atomik; 15 — Amankan login dan navigasi khusus Tenant.

**Status:** ready-for-agent

- [ ] Backfill eksplisit selesai dan audit verify melaporkan nol ownerless application, collision NPSN, multiple pending, invalid identity path, serta relasi approval–Tenant yang tidak konsisten.
- [ ] Kolom kepemilikan, binding, attempt, idempotency, dan hash yang diwajibkan menjadi non-null setelah seluruh reader/writer baru aktif.
- [ ] Constraint final menegakkan unique user dan canonical NPSN binding, unique binding-attempt, unique owner-idempotency, satu pending per binding, serta legal decision state.
- [ ] Kontrak anonymous submission, approval-created user, approval-created password, dan model activation lama sudah tidak mempunyai caller dan dihapus.
- [ ] Migrasi Kredensial sementara mempertahankan row count serta seluruh timestamp baseline satu-banding-satu.
- [ ] Setiap approved Pengajuan mempunyai tepat satu Tenant dan setiap Tenant application-derived menunjuk balik ke Pengajuan sumber.
- [ ] Fixture staging membuktikan urutan expand→backfill→verify→contract serta mendokumentasikan titik ketika rollback aplikasi lama tidak lagi aman.
- [ ] Prosedur recovery setelah contract atau approval baru menggunakan forward-fix atau recovery migration, bukan aplikasi lama terhadap schema baru.
- [ ] Seluruh concurrency suite membuktikan pemenang tunggal, tidak ada partial state, tidak ada duplicate Tenant, dan tidak ada final decision yang tertimpa.
- [ ] Browser E2E mencakup register→empty→submit→pending, reject→resubmit, approve→session revoked→login→Tenant, Provider-created temporary credential, role routing, cross-domain denial, dan open-redirect corpus.
- [ ] Full test suite, typecheck, lint, dan production build lulus.
- [ ] Checklist release mencatat hasil audit sebelum/sesudah, backup, migrasi staging, observability security log/outbox, dan keputusan go/no-go.
