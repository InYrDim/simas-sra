# Design the legacy role migration

Type: grilling
Status: resolved
Blocked by: 02, 03, 04, 13

## Question

How should existing singular `tenant_role` values and current authorization assumptions migrate to multi-role assignments without widening access, orphaning accounts, breaking active sessions, or preventing rollback?

## Answer

### Decision

Use a forward-only, fail-closed `expand → dual write → backfill → shadow verify → cut over → contract` migration. Keep `user.tenant_id` and `user.tenant_role` readable throughout the rollback window. Do not interpret a missing, unknown, malformed, or conflicting new assignment as permission to fall back to a broader role.

Migration must preserve the exact access that each account has immediately before cutover; it must not infer authority from a person's Guru, Staf, Siswa, or other domain profile. The legacy values are migration inputs only, not the future authorization vocabulary.

School Admin follows a separate Provider-owned path. It is not converted into a Tenant custom role or a row that School Admin can assign through Tenant RBAC. Provider provisioning and lifecycle operations must dual-write a dedicated, Tenant-scoped system School Admin membership while retaining `tenant_role = 'school-admin'` until contract. Non-admin legacy values become ordinary Tenant role assignments only after their exact legacy access has been mapped to concrete permission keys and verified not to widen access.

### Why the migration must remain compatibility-first

The current schema stores Tenant membership and one nullable enum together on `user`: `tenant_id` plus `tenant_role` with `school-admin`, `pimpinan`, `staff`, `guru`, `siswa`, and `guest`. Better Auth exposes both as non-input additional user/session fields, but authoritative guards such as `getMasterDataAccess` already re-query `user` on each request. Current Master Data authorization grants only when the persisted value is exactly `school-admin`; a `staff` value is explicitly denied.

The legacy value is also consumed outside ordinary request authorization:

- central identity treats `tenant_id` with a missing role as invalid and routes it to `/access-error`;
- Provider approval provisions a School Admin by writing `tenant_id` and `tenant_role = 'school-admin'`;
- Provider Tenant list/detail queries and applicant promotion discovery join on `tenant_role = 'school-admin'`;
- temporary-credential activation returns a principal structurally fixed to School Admin;
- page layout, dashboard, navigation, and user-directory display read the singular role;
- the people-import worker re-queries `user.tenant_role` inside the execution transaction and aborts when it is no longer `school-admin`;
- migration and MySQL tests create, revoke, and clean up authority by updating the legacy column directly.

Consequently, changing only the request guard would break provisioning, routing, reporting, activation, active sessions, and queued work. All of these consumers must be inventoried in the cutover checklist, and the worker must have its own cutover gate.

### Target compatibility model

The additive model should distinguish these records:

1. **Tenant membership.** The existing `user.tenant_id` remains the Tenant boundary during this migration. Every assignment and School Admin membership must carry the same `tenant_id`; composite foreign keys or equivalent transactional validation must prevent cross-Tenant attachment.
2. **Provider-owned School Admin membership.** Each dedicated system membership identifies one `(tenant_id, user_id)` School Admin authority. Provider code alone creates, transfers, suspends, or removes it; Tenant role-management code cannot write it. Issue 09 fixes cardinality at `1..n` active School Admin authorities for every active Tenant: multiple are permitted, pending/disabled authorities do not count, and committed lifecycle mutations must never leave an active Tenant with zero. Do not add a Tenant-level uniqueness constraint. Uniqueness may prevent duplicate authority rows for the same `(tenant_id, user_id)`, but must not prevent multiple different active School Admins in one Tenant.
3. **Tenant custom roles.** Stable Tenant-scoped role IDs with active permission assignments as defined by issues 03 and 04.
4. **User-role assignments.** Tenant-scoped `(tenant_id, user_id, role_id)` rows, unique and auditable. Only active custom roles grant permissions. Zero custom roles is valid and grants no custom-role permissions.
5. **Migration provenance.** Record source legacy value, migration run/version, creation time, and verification state on generated roles/assignments or in a dedicated ledger. Provenance supports reconciliation and rollback; it is never an authorization grant.

Do not model School Admin as a custom role named `School Admin`, and do not identify it by parsing a role name. Its effective permissions come from the system School Admin policy, including `school-admin-only` keys.

### Legacy mapping policy

Take a stable pre-backfill snapshot keyed by user ID, Tenant ID, raw legacy value, and relevant account/activation state. The migration planner must classify every row deterministically:

| Legacy state | New state | Access during compatibility period |
| --- | --- | --- |
| Valid Tenant + `school-admin` | Provider-owned system School Admin membership; no custom assignment implied | Exact legacy School Admin access |
| Valid Tenant + recognized non-admin value | One assignment to a Tenant-local frozen migration role containing exactly issue 13 L0 | Dashboard plus current same-Tenant `/users` directory/contact/security projection; every other Tenant RBAC key denied |
| Valid Tenant + `NULL`, unknown, or malformed value | No School Admin membership and no role assignment; reconciliation finding | Denied and routed to support/access error as today |
| Missing/invalid Tenant + any role | No assignment; blocking integrity finding | Denied |
| Provider Admin or applicant combined with Tenant membership | No automatic conversion; blocking multiple-identity finding | Denied until reconciled |
| Assignment whose Tenant differs from `user.tenant_id` | Reject/quarantine assignment | Denied |

Issue 13's **Exhaustive legacy-role equivalence and frozen migration grants** section is normative here. The five recognized non-admin values—`pimpinan`, `staff`, `guru`, `siswa`, and `guest`—are intentionally identical under current server behavior. Each receives a Tenant-local frozen migration role containing **exactly** these four L0 current-operation keys:

- `tenant.dashboard.view`
- `tenant.users.view`
- `tenant.users.view-contact`
- `tenant.users.view-sensitive`

Every other current-operation key is L1 and denied for every one of those roles. This includes every profile projection, master-data/reference read, mutation, assignment, lifecycle command, import/upload/download/export, protected document, PPDB operation, quiz operation, settings operation, and `tenant.onboarding.complete`. Unknown, new, or renamed keys also default to L1/deny until issue 13's partition and this issue's pinned map version are explicitly revised and equivalence is rerun. L2 authenticated shell and static/no-key surfaces may still render through membership but create no Permission Tenant grant; L3 Provider, auth/account, applicant/public PPDB, and public landing-page policies remain outside Tenant migration-role permission sets.

These four grants preserve—not broaden—the documented legacy exposure: all recognized roles pass the authenticated Tenant layout; the dashboard shell currently loads without an operation guard; and `/users` currently reads same-Tenant names, emails, legacy roles, and email-verification state. The minimum directory, contact, and sensitive keys preserve those real projections exactly even though the current `/users` exposure is overbroad. Menu visibility and static pages create no authority. No frozen role receives a wildcard, template-derived or profile-derived grant, Assigned/Self business access, mutation, sensitive-person data, export, or future-operation access; in particular, `guru` gains no teaching/quiz access and `siswa` gains no self/grade access because those current evaluators do not exist.

Legacy equivalence is evaluated using issue 13's mechanical tuple expansion `(legacy role, canonical key, surface, context, projection)`, not by page name or broad guard. Every L0 tuple expects `legacy=allow`; every L1 tuple expects `legacy=deny`; L2 emits no tuple; and L3 follows its separate policy. For each emitted tuple, compare the complete legacy and RBAC decisions after the same conjunction: exact persisted Tenant membership and activation (**T**), readable/writable operational state (**R/W**), applicable Provider entitlement (**MD**, **PPDB-R/W**, or **QUIZ-R/W**), exact permission, contextual scope, projection, and domain invariants. RBAC cutover requires zero `legacy=deny / RBAC=allow` tuples and preservation of every expected L0 projection.

### Authorization modes and dual reads

Deploy one centrally controlled compatibility resolver used by request guards, lifecycle queries, and workers. Record both decisions, but return according to an explicit mode:

- `legacy`: legacy decision is authoritative; compute the RBAC decision only for telemetry.
- `intersection`: authorize only when both legacy and RBAC authorize. This is the safe canary mode because it can narrow but cannot widen access.
- `rbac`: RBAC is authoritative only after equivalence gates pass. Unknown catalog keys, inactive roles, missing rows, Tenant mismatch, read errors, and ambiguous School Admin state deny.

Never use `legacy OR RBAC` for authorization. That union widens access whenever either side is stale or misconfigured. A temporary fallback may use the legacy result only in `legacy` mode and only while the legacy column is intentionally authoritative.

Compare decisions at the operation level after Tenant, operational/trial, entitlement, permission, and contextual checks—not merely at page or menu level. Log pseudonymous user/Tenant identifiers, operation key, legacy result/reason, RBAC result/reason, mode, and registry version without sensitive profile data.

School Admin compatibility is evaluated independently:

- in `legacy`, require persisted `tenant_role = 'school-admin'`;
- in `intersection`, require both the legacy value and the dedicated system membership for the same user and Tenant;
- in `rbac`, require the dedicated system membership and Provider-controlled lifecycle state; do not accept a custom role with equivalent permissions as School Admin.

### Dual writes

After expansion, all authority-changing commands must use one transactional compatibility writer:

- Provider School Admin provision/transfer/removal writes the dedicated system membership and the legacy `tenant_role`/`tenant_id` representation in the same transaction, together with temporary-credential activation where applicable.
- Tenant custom-role assignment writes only custom assignment tables. During the compatibility period it must not synthesize a singular legacy role, because multiple roles cannot be represented safely in one enum. Existing non-admin legacy rows remain a frozen rollback projection until their Tenant is cut over.
- Legacy code paths that still change a non-admin singular role must be routed through the compatibility writer, which updates the frozen projection and replaces the migration-generated assignment atomically. If any direct legacy writer cannot be removed or wrapped, cutover is blocked.
- Writes reject unknown legacy values, cross-Tenant IDs, attempts by Tenant actors to manage School Admin, inactive/archived roles, invalid dependencies, and partial updates. Audit both sides with a shared correlation ID.

After a Tenant enters RBAC-authoritative mode, disable legacy non-admin role mutation before allowing multiple custom assignments. Otherwise a rollback to one enum would silently discard authority information. Continue maintaining the School Admin legacy projection until all Provider and lifecycle consumers have cut over.

### Backfill

Run a bounded, resumable, idempotent backfill ordered by stable user ID, with an atomic checkpoint and deterministic IDs or uniqueness constraints. Each batch should:

1. re-read and lock or version-check the source user;
2. reject identity-path conflicts and invalid Tenant references;
3. create/verify the dedicated School Admin membership for exact `school-admin` rows, or create/verify a recognized non-admin row's frozen migration role containing exactly the four issue 13 L0 keys and no others, plus its assignment;
4. write provenance and audit records without changing the legacy columns;
5. advance the checkpoint in the same transaction.

Concurrent compatibility writes must either update both representations before the batch commits or cause the batch's source-version check to retry. A completed backfill must reopen if an old writer creates or changes an unprocessed legacy row, following the repository's existing resumable migration pattern.

Backfill does not create assignments for `NULL` or unknown roles, does not auto-assign templates, and does not repair ambiguous accounts by guessing. Findings must contain deterministic identifiers and reason codes suitable for an explicit reconciliation file or Provider workflow.

### Verification gates

No authorization cutover occurs until a repeatable verifier reports all mandatory invariants clean:

- every valid legacy School Admin user has exactly one matching authority row for that `(tenant_id, user_id)`, multiple active School Admin users per Tenant are preserved, every active Tenant has at least one active usable authority, and no authority lacks its matching legacy School Admin projection during compatibility;
- every `pimpinan`, `staff`, `guru`, `siswa`, and `guest` row has exactly one expected migration assignment whose frozen role has exactly `tenant.dashboard.view`, `tenant.users.view`, `tenant.users.view-contact`, and `tenant.users.view-sensitive`, with every L1/unknown key absent and denied;
- no unknown, malformed, or null role grants access;
- no role, assignment, or School Admin membership crosses Tenant boundaries;
- no custom role contains `school-admin-only`, `system-internal`, unknown, removed, malformed, or dependency-incomplete permissions;
- no active assignment points to draft/archived/missing roles;
- no Provider Admin/applicant/Tenant identity-path conflict is hidden by the migration;
- all direct writers and all consumers of `tenant_role` are either converted, wrapped, or explicitly retained for the current phase;
- issue 13's tuple expansion shows every L0 tuple as `legacy=allow` and RBAC allow with the same Tenant-wide projection, every L1 tuple as `legacy=deny`, no tuple for L2, separate policy for L3, and **zero `legacy=deny / RBAC=allow` tuples**; all unexpected L0 denials are resolved before cutover;
- School Admin provisioning, Provider Tenant list/detail, applicant promotion, temporary-credential activation, central routing, dashboard/layout, navigation, user display, request guards, and the import worker produce equivalent results;
- queued import work rechecks current authority at execution time under both models and fails when authority was revoked.

Verification metrics must be segmented by Tenant, legacy role, operation, request/worker surface, and mismatch direction. Store the registry version and source snapshot watermark so a clean report is not reused after data or catalog changes.

Required tests include planner idempotency and resume behavior; unknown/null/conflicting roles; cross-Tenant constraints; multiple School Admins, duplicate `(tenant_id, user_id)` prevention, the active-Tenant minimum-one invariant, and Provider-only mutation; issue 13 operation/projection/context equivalence with no legacy-deny/RBAC-allow cases; concurrent dual writes versus backfill; active pre-deployment sessions; permission revocation on the next request; worker revocation between enqueue and execution; Tenant-by-Tenant mode changes; emergency-mode entry/exit and atomic HTTP+worker version rollout; rollback at every phase; and final contract checks that no runtime SQL or TypeScript consumer references `tenant_role`.

### Sessions and next-request enforcement

Do not authorize from `session.user.tenantRole` or from role/permission claims captured when the session was created. Existing Better Auth session rows remain valid for authentication, so users need not be logged out merely because the schema expands. On every request, resolve Tenant membership, School Admin state, active role assignments, role permissions, Tenant/entitlement state, and contextual constraints from authoritative persistence through the central evaluator.

This preserves active sessions while ensuring grants and revocations take effect on the next request, as required by the map. Session fields may remain temporarily for display/compatibility, but their values cannot grant access. A lookup failure denies rather than trusting the session. At final contract, remove `tenantRole` from Better Auth additional fields and replace UI consumers with a non-authoritative display model derived from the authoritative resolver.

Long-running and queued work is a separate session boundary. The import worker must re-evaluate its specific execution permission and contextual gates inside the same transaction that locks the work row. Cut it over separately from HTTP requests; do not treat enqueue-time authorization as sufficient.

### Phased release plan

#### Phase 0 — baseline and freeze

- Pin the resolved issue 13 operation mapping and permission-registry version used for migration; any mapping or registry change invalidates prior equivalence reports.
- Inventory every read and write of `tenant_role`, including raw SQL, tests, fixtures, UI, Provider views, central identity, temporary credentials, and workers.
- Capture counts and a deterministic source snapshot; reconcile invalid identity paths and document accepted zero-role accounts.
- Prohibit new direct legacy writers.

Rollback: no data change.

#### Phase 1 — expand

- Add system School Admin membership, custom role, role-permission, user-role assignment, provenance/audit, and migration checkpoint structures as nullable/additive structures.
- Add Tenant-consistency constraints and indexes without dropping or tightening the legacy columns.
- Deploy code able to read old rows and dual-write new School Admin changes, with authorization still in `legacy` mode.

Rollback: deploy old code; additive empty/new tables remain inert. Do not drop them during an incident.

#### Phase 2 — backfill and shadow

- Backfill in resumable batches without modifying legacy values.
- Compute RBAC decisions in shadow for requests and workers.
- Reconcile every unknown/null/conflict and every potential widening; repeat until verification is clean at a fixed watermark.

Rollback: stop the backfill/shadow jobs and use legacy readers. Retain backfilled data for diagnosis or rerun; deleting it is unnecessary and riskier.

#### Phase 3 — intersection canary

- Move internal/test Tenants, then a small production cohort, to `intersection` mode independently for HTTP and workers.
- Keep dual-write and legacy projections active. Monitor denial deltas, lockout indicators, Provider School Admin lifecycle, and worker failures.
- Expand only after each cohort has zero unexplained differences.

Rollback: return the cohort to `legacy`; because legacy columns were preserved and dual-written, access returns to the pre-cutover model. Pause RBAC mutation UI if its changes are not representable in the singular legacy projection.

#### Phase 4 — RBAC cutover

- Move verified Tenants to `rbac` mode, requests before workers unless both have independently passed their gates.
- Enable multi-role assignment only after disabling legacy non-admin mutation for that Tenant.
- Continue shadow-comparing the legacy projection for a defined observation window. Keep School Admin dual-write until every Provider/lifecycle consumer is migrated.

Rollback: for a Tenant that has not accepted multi-role-only changes, switch back to `legacy`. After any multi-role-only assignment or custom-role edit is accepted, legacy rollback is forbidden. Enter the authoritative-RBAC emergency mode defined below; it preserves arbitrary role unions and can only narrow their current effective access.

#### Phase 5 — contract and cleanup

Contract only after the rollback window, all Tenants and workers are RBAC-authoritative, no direct legacy writer remains, session/UI consumers are migrated, shadow telemetry is clean, and rollback no longer depends on the enum.

- First stop dual writes and prove no runtime `tenant_role` read/write remains.
- Remove legacy session fields and compatibility code.
- In a later migration, drop `user.tenant_role`; do not combine cutover and drop in one release.
- Preserve migration provenance and authorization audit according to retention policy; archive generated migration roles only through the normal lifecycle after assignments are explicitly migrated.

Rollback after contract requires a forward fix using retained RBAC/audit data. Re-adding and guessing a singular role from multiple assignments is prohibited.

### Operational rollback recommendation

Prefer code/config rollback over data rollback before multi-role-only changes. A rollback must never use `legacy OR RBAC`, delete assignments, reverse audit history, infer one legacy role from multiple roles, or collapse an arbitrary role union into the legacy enum.

#### Authoritative-RBAC emergency mode

After multi-role-only state exists, rollback means switching the central resolver from a known-good `rbac@<version>` to `rbac-emergency@<version>`, not returning to `legacy`. The version is an immutable, deployable policy bundle containing the pinned permission-registry version, issue 13 operation map version, and an emergency deny overlay. The resolver continues reading current authoritative School Admin lifecycle records, active custom roles, user-role assignments, and current Tenant/account/entitlement/context state on every request and worker transaction. It computes normal effective RBAC first, then applies the overlay by intersection:

`emergency allow = current authoritative RBAC allow AND operation is not denied by the emergency overlay`.

The overlay may deny selected canonical issue 13 permission keys, entire mutation classes, sensitive/contact/export projections, specific Tenants, or all nonessential writes. It cannot add a key, replace a failed prerequisite, broaden contextual scope, bypass T/R/W or entitlements, reactivate an archived role, or manufacture School Admin authority. Unknown mode versions, stale registry/map versions, missing configuration, or resolver errors deny. School Admin lifecycle and the active-Tenant minimum-one invariant remain Provider-owned and authoritative; emergency mode does not convert School Admin to a custom or legacy role.

**Entry criteria and control:** enter only for a declared security/availability incident after multi-role rollback to `legacy` is unsafe, with an identified last-known-good resolver version and a reviewed deny overlay. A reauthenticated Provider Admin with emergency authority approves the target Tenant/cohort, reason, incident/correlation ID, mode version, expected current version, expiry/review time, and impact preview. The command locks/version-checks the rollout record, validates that the overlay is monotonic-narrowing against the pinned normal policy, and writes approval plus before/after policy hashes to immutable audit. Tenant actors cannot enter, alter, or exit this mode.

**Atomic HTTP and worker behavior:** one authoritative rollout record per Tenant/cohort contains a single epoch and `{mode, resolverVersion, registryVersion, operationMapVersion, overlayHash}` consumed by both HTTP and workers. Activation is one compare-and-swap transaction; there are not independent HTTP and worker mode toggles after multi-role state exists. Every HTTP authorization and every worker claim/execution transaction reads the current epoch. A process that does not support the activated version fails closed and stops mutations. Already claimed work rechecks the epoch and full emergency decision inside its write transaction before committing; an epoch change aborts/requeues or records a non-mutating authorization failure. Queued mutation intake may be paused first, but HTTP and worker authorization become effective from the same committed epoch.

**Behavior while active:** preserve all RBAC assignments and audit history; revoke nothing merely to enter the mode. Continue next-request and execution-time authoritative rechecks. Expose metrics by Tenant, operation key, projection, surface, resolver version, and denial reason. Provider support may repair RBAC data through separately authorized, audited recovery commands, but cannot grant through the overlay. Emergency mode may reduce availability to protect confidentiality and integrity.

**Exit criteria:** the incident root cause is fixed; the candidate normal `rbac@<new-version>` supports the stored registry/map versions; backfill/integrity verification is clean; issue 13 shadow replay against current authoritative RBAC has no unexpected allow or denial; HTTP and worker compatibility tests pass; queued work is reconciled; and a second reauthenticated Provider approval records the evidence and expected emergency epoch. Exit is another atomic compare-and-swap of the shared rollout record to the reviewed normal version, followed by heightened monitoring. Do not remove the audit record or emergency bundle until the retention and rollback window expires.

Before enabling Tenant-facing RBAC mutations, take an immutable export of the legacy projection and verified RBAC graph for evidence only. Once multi-role state exists, that snapshot cannot authorize or reconstruct current access because it may restore revoked grants. Security and Tenant isolation take precedence over availability.

### Evidence from the repository

- `monorepo/db/schema.ts` defines nullable singular `user.tenantRole` and no current role/permission join tables.
- `monorepo/lib/platform/auth.ts` exposes `tenantId` and `tenantRole` as Better Auth additional fields.
- `monorepo/lib/platform/central-identity-data.ts` re-queries persisted identity; `central-identity.ts` rejects Tenant membership with a missing role.
- `monorepo/lib/master-data/tenant-master-data-access-data.ts` re-queries membership per request, while `tenant-master-data-access.ts` authorizes only exact persisted `school-admin` and preserves Tenant/domain non-disclosure.
- `monorepo/lib/provider/provider-application-data.ts`, `provider-tenant-data.ts`, and `applicants/applicant-portal-data.ts` use exact School Admin values for provisioning and lifecycle/reporting queries.
- `monorepo/lib/tenancy/temporary-credential-activation-data.ts` currently returns a School Admin-specific principal.
- `monorepo/lib/imports/people-import-execution-data.ts` performs an execution-time transactional School Admin recheck, and its MySQL test proves revocation after enqueue must stop work.
- `monorepo/lib/tenancy/tenant-operational-migration.test.ts` and `docs/migrations/tenant-operational-model.md` establish the repository's bounded, resumable, shadow-verified, forward-only migration precedent; `temporary-credential-activation-migration.test.ts` demonstrates old-writer compatibility during expansion.
- Issue 03 requires stable explicit permission keys and fail-closed unknown keys; issue 04 makes School Admin Provider-owned and templates non-granting; therefore direct enum-to-template conversion would violate both decisions and could widen access.
