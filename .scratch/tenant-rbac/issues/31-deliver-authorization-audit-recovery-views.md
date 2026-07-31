# 31 — Deliver authorization audit and recovery views

**What to build:** Authorized users and operators can inspect appropriately scoped security history, verify integrity, export safe records, and execute forward-only recovery workflows without creating bypass authority.

**Blocked by:** 17 — Add the transactional security-command foundation; 21 — Deliver Role Tenant lifecycle end to end; 22 — Deliver multi-role assignment and effective access; 23 — Deliver non-admin account lifecycle; 30 — Deliver Provider School Admin lifecycle UI.

**Status:** ready-for-agent

- [ ] Canonical events cover role, permission, assignment, zero-role, non-admin account, School Admin, migration, recovery, and integrity lifecycles with actor, context, before/after, diff, reason, version, correlation, and batch/case data.
- [ ] School Admin receives Tenant-scoped authorization history, affected users receive only safe self-history, Provider Admin receives Provider lifecycle history, and restricted security telemetry is not exposed through either UI.
- [ ] Audit payloads and exports exclude secrets, redact unnecessary personal data, neutralize spreadsheet formulas, and never cross Tenant or security-context partitions.
- [ ] Sequence/hash-chain verification detects modified, deleted, reordered, duplicated, forked, or unanchored events and raises an operational signal.
- [ ] Retention, legal hold, post-Tenant-deletion minimization, and retention certificates follow the approved policy without rewriting retained events.
- [ ] Recovery restores valid forward state through normal authority models, never through a shared bypass account, direct database edit, audit replay, or silent assignment restoration.
- [ ] Views and recovery commands include loading, empty, filtered-empty, error, stale, correlation-ID, accessibility, and safe export states.
- [ ] Tests cover projection boundaries, self-history, formula safety, chain tampering, retention, audit failure rollback, and recovery authorization.
