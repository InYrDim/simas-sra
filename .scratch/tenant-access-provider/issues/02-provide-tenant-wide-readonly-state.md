# 02 — Provide tenant-wide read-only state

**What to build:** Every component in the authenticated tenant area can consume shared read-only access state initialized by the server, with trial messaging and the open page automatically reflecting expiry without an extra client request.

**Blocked by:** 01 — Canonicalize tenant write-access enforcement.

**Status:** ready-for-agent

- [ ] The authenticated tenant component tree is wrapped by one access provider initialized from the canonical server policy.
- [ ] Consumers can read `isReadOnly` and a machine-readable reason through a dedicated hook.
- [ ] Using the hook outside its provider fails clearly rather than defaulting to writable access.
- [ ] The provider automatically changes presentation state when an open page crosses the trial deadline.
- [ ] Client state and browser time are used only for presentation; server time remains authoritative for mutation authorization.
- [ ] Trial messaging consumes the shared access evaluation and no longer performs an independent tenant lookup or expiry calculation.
- [ ] Automated consumer-level tests cover initial writable/read-only state, reason exposure, missing-provider behavior, and the deadline transition.
