# Tenant RBAC rollout runbook

Issue 32 introduces a fail-closed rollout contract. This runbook is intentionally
operational: a command must not be promoted because a dashboard looks healthy.
Every promotion stores the contract digest, source watermark, resolver/registry/
operation versions, approvers, and an observation window.

## Promotion order

1. Confirm the Tenant has a valid `tenant_rbac_rollout` row and supported resolver,
   registry, operation-map, epoch, and version.
2. Run the HTTP cohort in `intersection`; record differential comparisons and all
   seven gates: no unexplained widening, isolation match, next-request revocation,
   worker execution, audit integrity, supported version, and School Admin coverage.
3. Promote HTTP to `rbac` only with the evidence record and a Provider
   reauthentication proof. Repeat independently for workers. Worker jobs must
   carry the enqueue epoch and re-evaluate authority at execution time.
4. Stop immediately on any unexplained widening, isolation mismatch, revocation
   failure, worker failure, audit-chain failure, unsupported version, or coverage
   violation. Do not repair a failed gate by changing the evaluator or overlay.

## Emergency narrowing

Emergency mode reads authoritative RBAC; it never reads legacy authority and
cannot add permissions. The overlay is immutable, hash-bound, and contains only
operation/permission denies or a mutation-wide deny. HTTP and workers enter under
one compare-and-swap epoch, requiring Provider reauthentication, reason, expected
epoch,
policy hash, impact preview, and expiry/review evidence. Exit requires verified
exit evidence under the same CAS protocol. If any field is missing, remain in the
current safe mode.

## Rollback boundary

Before multi-role-only state, rollback may return to legacy only when the stored
compatibility data says `rollbackEligible`. Once multi-role authority is accepted
or legacy mutation authority is disabled, rollback to singular authority is
forbidden. Use emergency narrowing instead. Never reconstruct legacy role state
from audit events or browser input.

## Verification and evidence

- `pnpm rbac:rollout:verify` is a local forbidden-reference and contract scan; it
  is not production evidence.
- Run `pnpm rbac:health:check` and the mandatory MySQL security, HTTP, worker,
  Playwright, accessibility, typecheck, lint, and production-build gates for the
  release bundle.
- Follow [MySQL backup/restore rehearsal](./mysql-backup-restore-rehearsal.md)
  against an explicitly disposable target and retain the generated evidence.
- Handle emergency entry and exit through the
  [incident runbook](./tenant-rbac-incident-runbook.md), validate its evidence,
  and use the [health signal catalog](./tenant-rbac-health-signals.md).
- Verify audit heads/chains, migration checkpoints, and cohort watermarks from
  the production evidence store.
- Keep the issue open until production evidence exists and every blocker is
  attached to the release record.

## Current repository limitation

The repository now supplies the policy, command/CAS seam, persisted emergency
state, Provider dashboard, health signals, evidence validators, backup/restore
rehearsal harness, tests, and a legacy-reference verifier. It cannot manufacture
bounded production cohorts, Provider approvals, real reauthentication evidence,
a disposable restore target, or external alert-delivery evidence. Operators must
run the supplied procedures in authorized environments; absent evidence remains
a release blocker and is not a reason to weaken the gates or mark Issue 32
resolved.
