# 03 — Disable tenant mutation UI safely

**What to build:** Tenant mutation controls present consistent, accessible disabled behavior from shared access state while navigation, sessions, data viewing, and access-recovery paths remain usable; all current mutation endpoints are verified against the server enforcement boundary.

**Blocked by:** 01 — Canonicalize tenant write-access enforcement; 02 — Provide tenant-wide read-only state.

**Status:** ready-for-agent

- [ ] The representative tenant mutation control is disabled when shared access is read-only and remains interactive when writable.
- [ ] Disabled behavior uses native semantics where available and appropriate accessible semantics where native disabling is unavailable.
- [ ] The UI communicates why mutation is unavailable without relying only on visual styling.
- [ ] Navigation, logout/session controls, read-only content, and provider-contact or access-recovery controls remain usable in read-only mode.
- [ ] Existing tenant-facing Server Actions and API mutation routes are inventoried and use the canonical server enforcement boundary.
- [ ] Provider-level tenant creation or access-management operations are recorded and preserved as explicit privileged exceptions.
- [ ] An integration test proves provider read-only state becomes accessible disabled UI, while a separate enforcement test continues to prove direct requests are rejected.
- [ ] Lint, automated tests, and the production build pass.
