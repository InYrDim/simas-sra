# 21 — Eksekusi dan laporkan hasil impor

**What to build:** Jalankan row impor yang sudah direview melalui durable execution job dengan transaksi atomik per row, idempotent retry, per-row results, dan emergency stop.

**Blocked by:** 20 — Review dan koreksi hasil impor.

**Status:** resolved

- [x] Confirmation menampilkan jumlah create, link, skip, reject, dan exact revision/row set yang akan dibekukan.
- [x] Semua warning wajib memiliki explicit decision sebelum row eligible.
- [x] Setiap selected row atomik untuk Warga Sekolah, target profile, initial lifecycle/history, audit, dan durable success marker.
- [x] Failure satu row tidak rollback successful row lain; batch dapat berakhir Selesai Sebagian.
- [x] Idempotency terikat ke Tenant, batch, revision, dan selected row set.
- [x] Worker restart atau duplicate delivery melewati row yang sudah memiliki committed success marker.
- [x] Sebelum setiap commit, worker memeriksa Tenant, feature flag, Tenant lifecycle, current executor authority, validity, uniqueness, dan match eligibility.
- [x] Import hanya membuat profile baru atau menambah target profile ke explicit Warga Sekolah; tidak update/archive/reactivate existing profile dan tidak membuat/mengubah Akun Pengguna.
- [x] Emergency stop membiarkan current transaction selesai lalu mencegah row berikutnya diambil.
- [x] Summary dan downloadable result workbook memisahkan created, linked, skipped, rejected, failed, dan already-committed outcomes.
- [x] Unexecuted batch menjadi read-only setelah 30 hari; binary retention policy wajib dikonfigurasi sebelum execution flag aktif.
- [x] Two-worker concurrency, restart, partial failure, revoked authority, double-submit, account non-creation, result aggregate, dan reconciliation memiliki MySQL/E2E tests.

## Comments

Implemented durable Tenant-scoped execution confirmation, immutable row-set idempotency, `SKIP LOCKED` worker claims, atomic per-row person/profile/history/audit/success-marker transactions, partial completion, execution-time authority/lifecycle/feature/uniqueness checks, Tenant emergency-stop claim filtering, 30-day read-only batches, retention-gated activation, separated result aggregates/workbook download, and account non-creation. Review found no ticket-21 scope creep or unresolved security/tenant-isolation issue. Evidence on 2026-07-21: real-MySQL two-worker/restart/partial-failure/revoked-authority/double-submit/account/reconciliation test passed; full 267-test suite passed; TypeScript typecheck passed; ESLint passed; and `git diff --check` passed.
