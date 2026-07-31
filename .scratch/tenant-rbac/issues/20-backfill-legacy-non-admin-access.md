# 20 — Backfill legacy non-admin access without widening

**What to build:** Resumable migration of recognized singular non-admin roles into frozen Role Tenant assignments whose effective access exactly preserves current behavior and never adds business capability.

**Blocked by:** 18 — Introduce the centralized evaluator in shadow mode; 19 — Project School Admin into dedicated authority.

**Status:** claimed

- [ ] Each recognized legacy non-admin role is mapped to the exact frozen permissions approved by the operation contract, and every other permission is denied.
- [ ] Null, unknown, malformed, conflicting, or cross-Tenant states create findings and no grant; profile names and Template Role Tenant are never used to infer authority.
- [ ] Backfill is bounded, resumable, idempotent, checkpointed, and converges safely with compatibility writes occurring concurrently.
- [ ] Provenance records distinguish migration roles from Tenant-created roles without making provenance an authority source.
- [ ] A repeatable verifier expands every legacy operation tuple and proves zero `legacy deny / RBAC allow` outcomes at a recorded watermark and contract digest.
- [ ] Existing sessions continue to authenticate, while shadow decisions always use current persistence rather than stale session role fields.
- [ ] Real database tests cover interruption, restart, concurrent writes, duplicate prevention, findings, and deterministic reruns.
