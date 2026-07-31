# 15 — Encode the RBAC executable contract

**What to build:** A versioned, machine-readable Permission Tenant registry and operation map that classify every authenticated Tenant entry point and can generate authorization coverage checks before enforcement changes begin.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] The registry represents every current and reserved permission from the approved specification with stable key, module, Indonesian label and description, dependency, risk, assignment classification, lifecycle, and replacement metadata.
- [ ] The operation map represents every current page data load, server action, route handler, protected download/export, domain command, and worker entry point, or explicitly classifies it outside Tenant RBAC.
- [ ] Validation rejects malformed or duplicate keys, dependency cycles, invalid classification, deprecated-for-new-use keys, and custom-role selection of `school-admin-only` or `system-internal` permissions.
- [ ] Generated coverage fails when an authenticated Tenant entry point is unmapped or still treats a role name, client state, navigation rule, broad legacy guard, or entitlement as its final permission decision.
- [ ] Registry and operation-map versions and digests are deterministic and available to rollout and migration verification.
- [ ] Tests cover the approved legacy equivalence partitions, reserved target operations, and unknown-key fail-closed behavior.
