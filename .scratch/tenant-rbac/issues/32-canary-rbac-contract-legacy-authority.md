# 32 — Canary RBAC and contract legacy authority

**What to build:** Promote Tenant and worker authorization safely from verified intersection mode to RBAC, rehearse narrowing emergency response, and remove all runtime authority dependence on singular legacy roles.

**Blocked by:** 24 — Secure dashboard, user directory, and Tenant settings; 25 — Secure academic and class operations; 26 — Secure people and profile operations; 27 — Secure facilities and student-activity operations; 28 — Secure people-import workflows and workers; 29 — Secure PPDB and quiz operations; 30 — Deliver Provider School Admin lifecycle UI; 31 — Deliver authorization audit and recovery views.

**Status:** ready-for-agent

- [ ] Internal/test Tenants and then bounded production cohorts move through intersection separately for HTTP and workers with recorded contract digests, watermarks, versions, approvers, and observation windows.
- [ ] Promotion pauses on any unexplained widening, isolation mismatch, next-request revocation failure, worker execution-time failure, audit-integrity failure, unsupported version, or School Admin coverage violation.
- [ ] Multi-role mutation is enabled only after legacy non-admin mutation is disabled for that Tenant and rollback eligibility is stored authoritatively.
- [ ] Before multi-role-only state, rollback returns safely to legacy using preserved compatibility data; afterward, rollback to singular authority is forbidden.
- [ ] Versioned emergency RBAC mode continues reading authoritative RBAC and applies only a provably narrowing deny overlay under one compare-and-swap HTTP/worker epoch.
- [ ] Emergency entry and exit require Provider reauthentication, reason, incident, expected epoch, policy hashes, impact preview, expiry/review time, immutable audit, and verified exit evidence.
- [ ] All runtime SQL, server, session, worker, UI, and navigation authority references to singular `tenant_role` are migrated before dual writes stop; legacy storage is dropped only in a later safe release.
- [ ] Required dashboards, alerts, migration verifiers, audit-chain checks, backup/restore evidence, forbidden-reference scans, and incident runbooks are operational and rehearsed.
- [ ] Final unit, service, mandatory MySQL, HTTP, worker, Playwright, accessibility, typecheck, lint, and production build gates pass for the versioned release bundle.
