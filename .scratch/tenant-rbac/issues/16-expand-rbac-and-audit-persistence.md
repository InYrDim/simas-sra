# 16 — Expand persistence for RBAC and security audit

**What to build:** Additive persistence for Tenant RBAC and security lifecycle state that can coexist safely with the singular legacy role model without changing current authorization decisions.

**Blocked by:** 15 — Encode the RBAC executable contract.

**Status:** ready-for-agent

- [ ] Persistence can represent Tenant-owned roles, role permission keys, user-role assignments, suspended assignments, role and assignment versions, template/copy provenance, and lifecycle states.
- [ ] Provider-owned School Admin authority and proof state are represented separately from custom Role Tenant records and support one or more active authorities per active Tenant.
- [ ] Non-admin account lifecycle cases, idempotency records, transactional outbox records, rollout mode/epoch, migration checkpoints, and reconciliation findings are representable.
- [ ] Append-only audit events and a lockable sequence/hash head are Tenant- or Provider-context qualified and cannot reference another Tenant's security objects.
- [ ] Composite constraints, indexes, and uniqueness rules reject cross-Tenant references, normalized duplicate role names, duplicate assignments, and invalid one-to-one Warga Sekolah account links.
- [ ] The migration is additive and rollback-safe: existing code and legacy columns continue to operate unchanged after expansion.
- [ ] Real database tests exercise constraints, old-code compatibility, migration up/down behavior where supported, and concurrent uniqueness races.
