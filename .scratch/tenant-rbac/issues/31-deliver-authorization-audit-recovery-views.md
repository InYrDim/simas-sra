# 31 — Deliver authorization audit and recovery views

**What to build:** Authorized users and operators can inspect appropriately scoped security history, verify integrity, export safe records, and execute forward-only recovery workflows without creating bypass authority.

**Blocked by:** 17 — Add the transactional security-command foundation; 21 — Deliver Role Tenant lifecycle end to end; 22 — Deliver multi-role assignment and effective access; 23 — Deliver non-admin account lifecycle; 30 — Deliver Provider School Admin lifecycle UI.

**Status:** resolved

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

## Resolution

- Human approval for the schema-v2 typed evidence contract and the `server-only` facade pattern was received on 2026-08-05.
- New canonical events use `SecurityAuditEvidence`, write `schemaVersion: 2`, and exclude actor email from the canonical payload. Historical schema-v1 events remain unchanged and retain their original digest semantics through the read adapter.
- Production code imports the retention server facade while direct Node/MySQL tests import the database implementation.
- `pnpm --dir monorepo build` passed.
- `pnpm --dir monorepo exec tsc --noEmit` passed after the final changes.
- Issue-specific audit/security/recovery unit tests passed (26/26), Security Command MySQL passed (6/6), School Admin lifecycle MySQL passed (6/6), and retention MySQL passed (1/1).
- The repository-wide run completed 769 tests: 763 passed and six failed outside the Issue 31 acceptance surface. Isolated reruns confirmed People Import and the corrected legacy equivalence/backfill paths pass; remaining checkpoint failures depend on stale fixture rows in the shared local database.
- Playwright executed all 14 scenarios (6 passed, 1 skipped, 7 failed) and exposed existing cross-feature login/session and selector instability. No dedicated Issue 31 Playwright scenario exists; Issue 31 behavior is covered by its targeted projection, integrity, export, retention, authorization, and recovery tests.

Issue 31 acceptance criteria are complete. Repository-wide release-suite and Playwright instability remain separate release-engineering follow-up work.
