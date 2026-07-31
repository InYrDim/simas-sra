# 18 — Introduce the centralized evaluator in shadow mode

**What to build:** A server-owned authorization evaluator that computes RBAC decisions beside legacy authorization, records safe comparisons, and leaves user-visible decisions unchanged while the migration is verified.

**Blocked by:** 15 — Encode the RBAC executable contract; 16 — Expand persistence for RBAC and security audit.

**Status:** ready-for-agent

- [ ] The evaluator derives authority from the session user ID and current persisted account, Tenant, School Admin authority, role, assignment, permission, entitlement, and contextual state on every request.
- [ ] Evaluation follows the approved fail-closed order and unknown, malformed, inactive, suspended, archived, unsupported-version, or unavailable-store state grants nothing.
- [ ] Request-local memoization is permitted, but no cross-request cache or permission-bearing token becomes authoritative.
- [ ] Internal denial reasons are structured while external behavior preserves login/`401`, safe `403`, and concealed `404` contracts.
- [ ] Shadow mode records legacy/RBAC allow-deny direction, operation, surface, mode, and version without exposing personal data or changing the legacy result.
- [ ] A shared rollout mode and epoch are understood by HTTP entry points and workers; unsupported or stale versions fail closed for mutation.
- [ ] Generated policy tests exercise School Admin, exact custom grants, zero roles, inactive accounts, invalid role/assignment state, entitlement, read-only Tenant, wrong Tenant, projections, and declared contextual arms.
