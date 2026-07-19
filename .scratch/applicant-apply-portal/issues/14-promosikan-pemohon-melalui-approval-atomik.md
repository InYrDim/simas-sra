# 14 — Promosikan Pemohon melalui approval atomik

**What to build:** Provider Admin dapat menyetujui Pengajuan pending dengan domain final dan sistem menyediakan Tenant sekaligus mempromosikan Pemohon existing menjadi School Admin. User mempertahankan akun dan password, semua sesi lama dicabut, tidak ada Kredensial sementara, dan setelah login ulang School Admin dapat melihat riwayat serta masuk ke Tenant.

**Blocked by:** 10 — Migrasikan model Kredensial sementara; 13 — Tolak dan ajukan ulang Pengajuan SIMAS.

**Status:** ready-for-agent

- [ ] Form approval menyarankan domain dari nama sekolah tetapi Provider Admin menentukan domain final yang dinormalisasi, divalidasi, dan unik.
- [ ] Approval mengunci binding, Pengajuan, user, lalu record terkait dalam urutan kanonis dan memvalidasi ulang seluruh invariant.
- [ ] Satu transaksi membuat Tenant dari snapshot dan canonical NPSN, menghubungkan Pengajuan sumber, mempromosikan owner user existing menjadi School Admin, mencabut seluruh session, mencatat Provider decision, memfinalkan status, dan menulis audit/outbox.
- [ ] User ID, credential account, dan password existing tetap sama; snapshot contact email tidak menentukan user yang dipromosikan.
- [ ] Jalur Pemohon aktif dihapus saat promosi, sementara binding permanen dan seluruh history Pengajuan tetap tersedia.
- [ ] Approval tidak membuat user, credential account, Kredensial sementara, atau temporary-credential activation baru dan UI sukses tidak menampilkan secret.
- [ ] Domain yang sudah dipakai membatalkan seluruh transaksi dan membiarkan Pengajuan pending; Tenant existing untuk NPSN menghasilkan data conflict.
- [ ] Retry approval dengan domain/result identik mengembalikan Tenant existing; domain atau keputusan berbeda setelah final menghasilkan conflict.
- [ ] Failure injection pada setiap tahap membuktikan Tenant, promosi, keputusan, session deletion, dan outbox rollback bersama-sama.
- [ ] Approval bersamaan menghasilkan tepat satu Tenant dan satu hasil final tanpa data tambahan.
- [ ] Session Pemohon lama tidak dapat dipakai setelah commit; login ulang memuat role School Admin baru.
- [ ] `/apply` School Admin menampilkan approval, immutable history, dan tautan Tenant server-derived serta tidak menawarkan submit baru.
- [ ] Browser test membuktikan pending→approval→session revoked→login ulang→portal approved→Tenant tanpa jalur change-password.
