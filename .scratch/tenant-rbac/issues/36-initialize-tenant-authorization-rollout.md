# 36 — Initialize Tenant authorization rollout during provisioning

**Type:** grilling
**Status:** unclaimed
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
