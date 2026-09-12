# 23 — Deliver non-admin account lifecycle

**What to build:** A School Admin can create, invite, link, activate administratively, deactivate, reactivate, and initiate recovery for non-admin Akun Pengguna without crossing the Provider-owned School Admin boundary.

**Blocked by:** 17 — Add the transactional security-command foundation; 22 — Deliver multi-role assignment and effective access.

**Status:** resolved

- [x] School Admin can create or invite an eligible same-Tenant non-admin account and optionally link exactly one same-Tenant Warga Sekolah without deriving authority from the profile.
- [x] Email collision and lookup behavior does not disclose another Tenant, Provider Admin, Applicant, School Admin, or existing account beyond the caller's authority.
- [x] Resend idempotently redelivers the same still-valid activation material without changing digest or expiry; reissue revokes and replaces prior material.
- [x] One-time secrets are CSPRNG-generated, hash-only at rest, purpose/Tenant/user/expiry bound, absent from URLs/logs/audit/export, and never redisplayed.
- [x] Deactivation revokes sessions and activation/recovery material and suspends assignments atomically without deleting history.
- [x] Reactivation explicitly selects zero or a currently valid subset of former roles; entitlement-disabled permissions remain assigned but unavailable at runtime.
- [x] Delivery uses an idempotent transactional outbox, and delivery failure never grants authority or creates an ambiguous lifecycle state.
- [x] Lifecycle UI includes accessible loaders, one-time-secret acknowledgement, conflict recovery, stale-state handling, and safe destructive confirmation.
- [x] Tests cover identity races, retries, token replay, session revocation, assignment suspension/restoration, cross-Tenant IDs, and School Admin targeting rejection.

## Comments

- 2026-08-03: Di-hold sebelum commit. Implementasi parsial belum memenuhi consumption/replay, delivery worker, dan pengujian MySQL/rollback. Penyelesaian resend menunggu keputusan resmi antara email provider dengan idempotent message retention atau derivasi HMAC dengan key dari secret manager.
- 2026-08-03: Dipilih derivasi HMAC dengan `TENANT_ACCOUNT_LIFECYCLE_SECRET_KEY` untuk kanal email. Resend mempertahankan case, digest, dan expiry yang masih valid serta menolak perubahan kanal; delivery worker dan konsumsi one-time secret masih tersisa.
- 2026-08-03: Ditambahkan konsumsi case Tenant-scoped yang mengunci case, memverifikasi digest dan expiry, menandai case completed, serta mengaktifkan akun secara atomik. Replay ditolak; delivery worker dan public consumption route masih tersisa.
- Issue 24–29 tidak bergantung pada Issue 23 dan dapat dilanjutkan. Issue 31 tetap diblokir langsung oleh Issue 23; Issue 32 terblokir transitif melalui Issue 31.
- Issue 24 menyentuh area `/users` yang sama dengan WIP Issue 23. Untuk menghindari konflik pada working tree saat ini, Issue 25 adalah pekerjaan independen berikutnya yang paling aman.
- 2026-08-03: Dipilih adapter email internal terlebih dahulu. Outbox worker, retry/idempotency, dan public activation/recovery route dapat diverifikasi tanpa ketergantungan kredensial provider email; integrasi provider nyata menjadi langkah lanjutan.
- 2026-08-03: Implementasi awal adapter, worker, dan public route dibuat, tetapi belum siap commit: adapter internal masih berupa sink, secret email masih mengikuti keputusan HMAC sebelumnya, dan UI publik belum memiliki loader/pengujian worker MySQL. Review keamanan menahan penyelesaian ticket sampai kontrak delivery final dan retry dapat dibuktikan.
- 2026-08-04: Implementasi activation/recovery consumption, replay rejection, credential reset atomik, delivery retry/backoff, conditional outbox publish, public-route concealment, dan accessible loader sudah ditambahkan. Unit lifecycle/delivery lulus, tetapi integration test MySQL lifecycle masih skip tanpa `TENANT_ACCOUNT_LIFECYCLE_SECRET_KEY` dan belum dapat menjadi bukti final; checklist tetap terbuka sampai race, rollback, dan outbox test dijalankan pada environment konfigurasi lengkap.
- 2026-08-04: Issue diselesaikan setelah real MySQL lifecycle test lulus. Coverage mencakup email collision/race, Provider/Applicant/School Admin targeting rejection, resend/reissue, activation replay/expiry, rollback saat linking profile, deactivation session revocation dan assignment suspension, reactivation role subset, cross-Tenant rejection, serta outbox delivery failure/retry. Typecheck, targeted lint, unit lifecycle/delivery, dan MySQL integration test lulus.
