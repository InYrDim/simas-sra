# 21 — Eksekusi dan laporkan hasil impor

**What to build:** Jalankan row impor yang sudah direview melalui durable execution job dengan transaksi atomik per row, idempotent retry, per-row results, dan emergency stop.

**Blocked by:** 20 — Review dan koreksi hasil impor.

**Status:** ready-for-agent

- [ ] Confirmation menampilkan jumlah create, link, skip, reject, dan exact revision/row set yang akan dibekukan.
- [ ] Semua warning wajib memiliki explicit decision sebelum row eligible.
- [ ] Setiap selected row atomik untuk Warga Sekolah, target profile, initial lifecycle/history, audit, dan durable success marker.
- [ ] Failure satu row tidak rollback successful row lain; batch dapat berakhir Selesai Sebagian.
- [ ] Idempotency terikat ke Tenant, batch, revision, dan selected row set.
- [ ] Worker restart atau duplicate delivery melewati row yang sudah memiliki committed success marker.
- [ ] Sebelum setiap commit, worker memeriksa Tenant, feature flag, Tenant lifecycle, current executor authority, validity, uniqueness, dan match eligibility.
- [ ] Import hanya membuat profile baru atau menambah target profile ke explicit Warga Sekolah; tidak update/archive/reactivate existing profile dan tidak membuat/mengubah Akun Pengguna.
- [ ] Emergency stop membiarkan current transaction selesai lalu mencegah row berikutnya diambil.
- [ ] Summary dan downloadable result workbook memisahkan created, linked, skipped, rejected, failed, dan already-committed outcomes.
- [ ] Unexecuted batch menjadi read-only setelah 30 hari; binary retention policy wajib dikonfigurasi sebelum execution flag aktif.
- [ ] Two-worker concurrency, restart, partial failure, revoked authority, double-submit, account non-creation, result aggregate, dan reconciliation memiliki MySQL/E2E tests.
