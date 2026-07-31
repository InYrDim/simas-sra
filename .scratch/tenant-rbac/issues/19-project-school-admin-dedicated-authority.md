# 19 — Project School Admin into dedicated authority

**What to build:** Preserve all current School Admin access while moving its authority to the Provider-owned system model, separate from custom Role Tenant and singular legacy role semantics.

**Blocked by:** 16 — Expand persistence for RBAC and security audit; 17 — Add the transactional security-command foundation; 18 — Introduce the centralized evaluator in shadow mode.

**Status:** ready-for-agent

- [ ] Existing valid School Admin users receive dedicated same-Tenant authority through an idempotent compatibility projection with no custom role record.
- [ ] Provisioning, central identity resolution, activation, Provider Tenant queries, session freshness, and protected Tenant access recognize the dedicated authority.
- [ ] Provider Admin does not become a Tenant principal, and Tenant actors cannot create, assign, disable, or recover School Admin authority.
- [ ] An active Tenant supports `1..n` active usable School Admin authorities; pending proof and disabled authority do not satisfy coverage.
- [ ] Current School Admin authorization remains behaviorally equivalent in legacy and shadow modes, and permission changes are observed on the next request.
- [ ] Ambiguous, cross-Tenant, malformed, or duplicate authority projection produces a reconciliation finding and fails closed.
- [ ] Tests cover existing sessions, temporary credentials, Provider promotion/provisioning, multiple School Admins, and zero-coverage prevention.
