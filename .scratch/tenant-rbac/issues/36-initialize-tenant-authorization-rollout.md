# 36 — Initialize Tenant authorization rollout during provisioning

**Type:** grilling
**Status:** resolved
**Blocked by:** 18 — Introduce centralized evaluator in shadow mode; 19 — Project School Admin into dedicated authority

## Question

Where and how must Tenant provisioning create the initial `tenant_rbac_rollout` record so every newly provisioned Tenant has a valid resolver version, permission registry version, operation-map version, epoch, and initial authorization mode before Tenant login is enabled?

The decision must also define:

- whether the first HTTP and worker modes are `legacy`, `intersection`, or another approved mode;
- whether rollout initialization is part of the same transaction as Tenant and School Admin provisioning;
- retry and idempotency behavior for interrupted provisioning;
- behavior for existing Tenants missing rollout state; and
- how version changes are migrated without granting access or producing an avoidable `403` for valid School Admin accounts.

New non-School-Admin accounts remain unassigned at creation. Their Role Tenant and Permission Tenant access is assigned later by School Admin through the existing assignment workflow.

## Decision

- Provider application approval initializes `tenant_rbac_rollout` immediately after Tenant creation, inside the same security-command transaction as Tenant and School Admin provisioning.
- Initial modes are `legacy` for both HTTP and workers, with epoch `1`, version `1`, resolver `tenant-authorization@1`, registry `tenant-permissions@2`, and operation map `tenant-operations@3`.
- A failed rollout insert rolls back the complete approval transaction. Retrying the approval is safe because the application lock and idempotency key prevent duplicate provisioning.
- Existing Tenants missing rollout state require the existing backfill/reconciliation path; provisioning does not silently create state for unrelated existing Tenants.
- Future version changes must be explicit rollout migrations that preserve the stored epoch/version history and update every Tenant under transactional or idempotent migration control.
