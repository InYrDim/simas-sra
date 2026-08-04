# 31 — Deliver authorization audit and recovery views

**What to build:** Authorized users and operators can inspect appropriately scoped security history, verify integrity, export safe records, and execute forward-only recovery workflows without creating bypass authority.

**Blocked by:** 17 — Add the transactional security-command foundation; 21 — Deliver Role Tenant lifecycle end to end; 22 — Deliver multi-role assignment and effective access; 23 — Deliver non-admin account lifecycle; 30 — Deliver Provider School Admin lifecycle UI.

**Status:** ready-for-human

- [x] Canonical events cover role, permission, assignment, zero-role, non-admin account, School Admin, migration, recovery, and integrity lifecycles with actor, context, before/after, diff, reason, version, correlation, and batch/case data.
- [x] School Admin receives Tenant-scoped authorization history, affected users receive only safe self-history, Provider Admin receives Provider lifecycle history, and restricted security telemetry is not exposed through either UI.
- [x] Audit payloads and exports exclude secrets, redact unnecessary personal data, neutralize spreadsheet formulas, and never cross Tenant or security-context partitions.
- [x] Sequence/hash-chain verification detects modified, deleted, reordered, duplicated, forked, or unanchored events and raises an operational signal.
- [x] Retention, legal hold, post-Tenant-deletion minimization, and retention certificates follow the approved policy without rewriting retained events.
- [x] Recovery restores valid forward state through normal authority models, never through a shared bypass account, direct database edit, audit replay, or silent assignment restoration.
- [x] Views and recovery commands include loading, empty, filtered-empty, error, stale, correlation-ID, accessibility, and safe export states.
- [x] Tests cover projection boundaries, self-history, formula safety, chain tampering, retention, audit failure rollback, and recovery authorization.

## Verification evidence

- `pnpm --dir monorepo exec tsc --noEmit` — passed.
- Targeted audit/security/recovery tests — 26 passed, 0 failed.
- `pnpm --dir monorepo test:security-command:mysql` — 6 passed, 0 failed.
- `pnpm --dir monorepo test:school-admin-lifecycle:mysql` — 6 passed, 0 failed.
- `pnpm --dir monorepo test:security-audit-retention:mysql` — 1 passed, 0 failed against `DATABASE_URL`.
- Recovery UI now integrates Provider-only start → proof → explicit reactivation with loading, stale/error, correlation ID, and accessible status states.

## Ready-for-human blockers

- The Issue 28 migration now uses MySQL-compatible conditional DDL with Drizzle statement breakpoints. `pnpm --dir monorepo db:migrate` applies successfully against the existing database and records the migration despite pre-existing claim columns.
- `pnpm --dir monorepo test:security-audit-retention:mysql` passes (1/1), and the Issue 28 worker suite passes (7/7) after the migration is applied through the normal path.
- `pnpm --dir monorepo test` previously exceeded the 180-second validation window without completing; a human release run is still required for the final full-suite gate and Playwright evidence.

Issue 31 is intentionally not marked resolved.
