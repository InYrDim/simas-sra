# 17 — Add the transactional security-command foundation

**What to build:** A shared service/store seam for security-sensitive commands so role, assignment, account, and School Admin mutations revalidate authority and commit state, audit, idempotency, and outbox effects atomically.

**Blocked by:** 16 — Expand persistence for RBAC and security audit.

**Status:** resolved

- [x] Commands derive actor and security context from the authenticated server principal and never trust browser-provided actor, authoritative Tenant, before-state, permission diff, or affected count.
- [x] The transaction contract supports optimistic versions, command fingerprints, stable idempotency keys, deterministic event ordering, and safe retry after deadlock or network replay.
- [x] Mandatory audit events, sequence/hash-head updates, business state, and required outbox records commit or roll back together.
- [x] Reusing an idempotency key with a different command fingerprint is rejected and security-signaled.
- [x] Multi-event commands allocate parent and child events deterministically without duplicate events, sequence gaps, or hash-chain forks.
- [x] Fault-injection tests prove failure at every state, audit, head, idempotency, and outbox step produces no partial authority change.
- [x] The seam is narrow enough for role, assignment, account, and School Admin services to reuse without defining independent security semantics.
