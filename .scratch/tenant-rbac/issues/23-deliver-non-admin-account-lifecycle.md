# 23 — Deliver non-admin account lifecycle

**What to build:** A School Admin can create, invite, link, activate administratively, deactivate, reactivate, and initiate recovery for non-admin Akun Pengguna without crossing the Provider-owned School Admin boundary.

**Blocked by:** 17 — Add the transactional security-command foundation; 22 — Deliver multi-role assignment and effective access.

**Status:** ready-for-agent

- [ ] School Admin can create or invite an eligible same-Tenant non-admin account and optionally link exactly one same-Tenant Warga Sekolah without deriving authority from the profile.
- [ ] Email collision and lookup behavior does not disclose another Tenant, Provider Admin, Applicant, School Admin, or existing account beyond the caller's authority.
- [ ] Resend idempotently redelivers the same still-valid activation material without changing digest or expiry; reissue revokes and replaces prior material.
- [ ] One-time secrets are CSPRNG-generated, hash-only at rest, purpose/Tenant/user/expiry bound, absent from URLs/logs/audit/export, and never redisplayed.
- [ ] Deactivation revokes sessions and activation/recovery material and suspends assignments atomically without deleting history.
- [ ] Reactivation explicitly selects zero or a currently valid subset of former roles; entitlement-disabled permissions remain assigned but unavailable at runtime.
- [ ] Delivery uses an idempotent transactional outbox, and delivery failure never grants authority or creates an ambiguous lifecycle state.
- [ ] Lifecycle UI includes accessible loaders, one-time-secret acknowledgement, conflict recovery, stale-state handling, and safe destructive confirmation.
- [ ] Tests cover identity races, retries, token replay, session revocation, assignment suspension/restoration, cross-Tenant IDs, and School Admin targeting rejection.
