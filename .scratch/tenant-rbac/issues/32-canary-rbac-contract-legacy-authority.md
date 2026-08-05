# 32 — Canary RBAC and contract legacy authority

**What to build:** Promote Tenant and worker authorization safely from verified intersection mode to RBAC, rehearse narrowing emergency response, and remove all runtime authority dependence on singular legacy roles.

**Blocked by:** 24 — Secure dashboard, user directory, and Tenant settings; 25 — Secure academic and class operations; 26 — Secure people and profile operations; 27 — Secure facilities and student-activity operations; 28 — Secure people-import workflows and workers; 29 — Secure PPDB and quiz operations; 30 — Deliver Provider School Admin lifecycle UI; 31 — Deliver authorization audit and recovery views.

**Status:** in-progress

- [ ] Internal/test Tenants and then bounded production cohorts move through intersection separately for HTTP and workers with recorded contract digests, watermarks, versions, approvers, and observation windows.
- [ ] Promotion pauses on any unexplained widening, isolation mismatch, next-request revocation failure, worker execution-time failure, audit-integrity failure, unsupported version, or School Admin coverage violation.
- [ ] Multi-role mutation is enabled only after legacy non-admin mutation is disabled for that Tenant and rollback eligibility is stored authoritatively.
- [ ] Before multi-role-only state, rollback returns safely to legacy using preserved compatibility data; afterward, rollback to singular authority is forbidden.
- [ ] Versioned emergency RBAC mode continues reading authoritative RBAC and applies only a provably narrowing deny overlay under one compare-and-swap HTTP/worker epoch.
- [ ] Emergency entry and exit require Provider reauthentication, reason, incident, expected epoch, policy hashes, impact preview, expiry/review time, immutable audit, and verified exit evidence.
- [x] All runtime SQL, server, session, worker, UI, and navigation authority references to singular `tenant_role` are migrated before dual writes stop; legacy storage is dropped only in a later safe release.
- [ ] Required dashboards, alerts, migration verifiers, audit-chain checks, backup/restore evidence, forbidden-reference scans, and incident runbooks are operational and rehearsed.
- [ ] Final unit, service, mandatory MySQL, HTTP, worker, Playwright, accessibility, typecheck, lint, and production build gates pass for the versioned release bundle.

## Implementation notes

- 2026-08-04: Added the rollout policy/state machine, independent HTTP/worker promotion commands, Provider reauthentication and CAS security-command path, hash-bound deny-only emergency overlay, emergency exit evidence, legacy rollback invariants, forbidden-reference verifier, rollout runbook, and focused tests.
- 2026-08-04: Issue remains in progress. The verifier still finds 38 runtime references to singular legacy authority, and production cohort evidence, dashboards/alerts, backup/restore rehearsal, external Provider approval evidence, and final release gates are not available in the repository environment. These must be completed before resolution; the issue is not marked resolved.
- 2026-08-05: Migrated lifecycle, assignment, identity, Provider roster, onboarding, activation, applicant promotion, user-directory, master-data access, and seed actor paths to canonical RBAC assignments or dedicated School Admin authority. The verifier now finds 7 references, all in the live legacy/intersection canary evaluator; removing them requires verified promotion of every HTTP and worker cohort to RBAC. Compatibility dual writes remain narrowly scanner-exempt, and the issue stays in progress pending external rollout evidence and final release gates.
- 2026-08-05: With explicit approval for the development environment, cut runtime authorization over to `tenant-authorization@2`: HTTP and workers now accept only `rbac`/`rbac-emergency`, legacy and intersection rows fail closed, new Tenant and test rollout rows initialize directly in RBAC, and the forbidden-reference verifier reports zero runtime singular-authority references. Compatibility storage and migration tooling remain for the later storage-drop release.
