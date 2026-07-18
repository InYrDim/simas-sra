# 09 — Complete Onboarding Tenant and start Trial Tenant once

**What to build:** A School Admin who has replaced the temporary credential can complete Onboarding Tenant, atomically saving the required configuration and starting Trial Tenant exactly once.

**Blocked by:** 08 — Activate the first School Admin securely.

**Status:** ready-for-agent

- [ ] Completion derives the Tenant from the authenticated database-backed School Admin principal rather than accepting a trusted Tenant identifier from form input.
- [ ] The guard requires matching Tenant membership, `school-admin` role, activation state, and completed credential change.
- [ ] Configuration changes and lifecycle timestamps commit atomically with no partially onboarded state.
- [ ] One UTC instant sets onboarding completion and trial start, and the trial end is exactly one calendar month later in UTC.
- [ ] Repeated completion returns an idempotent result without moving any trial date.
- [ ] Users from another Tenant or with another Tenant role cannot complete onboarding for the target Tenant.
- [ ] Usage-stage projection correctly distinguishes waiting for onboarding, in trial, ending within seven days, and expired without persisting a duplicate status enum.
