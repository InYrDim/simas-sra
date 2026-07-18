# 01 — Canonicalize tenant write-access enforcement

**What to build:** Tenant mutations use one canonical, fail-closed access policy so expired or indeterminate tenants cannot mutate data even when the browser UI is bypassed, while active tenants and valid tenants without a trial deadline retain write access.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] A single server-owned tenant access result defines whether mutations are writable or read-only and provides a machine-readable reason.
- [ ] A valid tenant is writable through the exact trial deadline and becomes read-only after it.
- [ ] A valid tenant with no trial deadline remains writable.
- [ ] A missing tenant or failed/indeterminate access evaluation fails closed and does not execute the protected mutation.
- [ ] Protected tenant mutations return a consistent forbidden-equivalent result with an understandable error when access is read-only.
- [ ] Direct invocation demonstrates that browser-side state cannot bypass server enforcement.
- [ ] Minimal automated test tooling is added and deterministic policy/enforcement tests pass using controlled time.
