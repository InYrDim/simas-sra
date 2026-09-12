# 28 — Secure people-import workflows and workers

**What to build:** Protect Batch Impor Orang from upload and validation through matching, execution, result download, and worker processing using exact permissions and execution-time authority.

**Blocked by:** 18 — Introduce the centralized evaluator in shadow mode; 20 — Backfill legacy non-admin access without widening; 22 — Deliver multi-role assignment and effective access; 26 — Secure people and profile operations.

**Status:** resolved

Implementation notes: execution and validation workers use a Node-safe adapter to the centralized evaluator on the same write transaction, recheck Tenant/account/authority/entitlement and rollout state, fence completion and failure updates with per-claim tokens, and atomically persist audit, success, outcome, and transactional-outbox records. Real MySQL worker coverage verifies concurrent workers, duplicate submission, stale claimant fencing, crash/reclaim boundaries, audit rollback, invalid batch items, stale process versions, rollout epoch changes, complete validation retry, revocation, partial failure, and outbox cardinality.

- [x] Upload, template download, validation, matching decisions, execution, status, result download, and retry operations use the exact operation-map permissions rather than broad import or feature checks.
- [x] Execution requires both import execution permission and every destination create/update permission required by the approved row decisions.
- [x] Source and generated files use private Tenant-qualified storage and server-derived paths and cannot expose another Tenant through names, errors, traversal, or substituted IDs.
- [x] Enqueue stores safe intent rather than an authority snapshot; workers reload rollout epoch, account, Tenant, role, permission, entitlement, context, target versions, and domain invariants on claim and inside the write transaction.
- [x] Permission, account, role, relationship, entitlement, write state, or rollout-epoch revocation after enqueue prevents unauthorized execution without partial side effects.
- [x] Atomic claim, leases, idempotency, audit, and outbox behavior prevent duplicate execution across retries, crashes, and concurrent workers.
- [x] Worker results expose safe requester-facing status and restricted telemetry without leaking concealed target details.
- [x] Real database and worker race tests cover duplicate claim, stale process version, crash boundaries, invalid batch items, audit failure, epoch change, and complete retry path.
