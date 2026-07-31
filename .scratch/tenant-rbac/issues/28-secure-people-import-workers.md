# 28 — Secure people-import workflows and workers

**What to build:** Protect Batch Impor Orang from upload and validation through matching, execution, result download, and worker processing using exact permissions and execution-time authority.

**Blocked by:** 18 — Introduce the centralized evaluator in shadow mode; 20 — Backfill legacy non-admin access without widening; 22 — Deliver multi-role assignment and effective access; 26 — Secure people and profile operations.

**Status:** ready-for-agent

- [ ] Upload, template download, validation, matching decisions, execution, status, result download, and retry operations use the exact operation-map permissions rather than broad import or feature checks.
- [ ] Execution requires both import execution permission and every destination create/update permission required by the approved row decisions.
- [ ] Source and generated files use private Tenant-qualified storage and server-derived paths and cannot expose another Tenant through names, errors, traversal, or substituted IDs.
- [ ] Enqueue stores safe intent rather than an authority snapshot; workers reload rollout epoch, account, Tenant, role, permission, entitlement, context, target versions, and domain invariants on claim and inside the write transaction.
- [ ] Permission, account, role, relationship, entitlement, write state, or rollout-epoch revocation after enqueue prevents unauthorized execution without partial side effects.
- [ ] Atomic claim, leases, idempotency, audit, and outbox behavior prevent duplicate execution across retries, crashes, and concurrent workers.
- [ ] Worker results expose safe requester-facing status and restricted telemetry without leaking concealed target details.
- [ ] Real database and worker race tests cover duplicate claim, stale process version, crash boundaries, invalid batch items, audit failure, and epoch change.
