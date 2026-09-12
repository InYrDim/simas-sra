# Fix validation and specification handoff

Type: grilling
Status: resolved
Blocked by: 07, 08, 09, 10, 11, 13, 14

## Question

What security tests, Tenant-isolation tests, permission-matrix tests, UI states, concurrency cases, migration checks, acceptance scenarios, and implementation slices must the final specification require before Tenant RBAC can ship safely?

## Answer

### Recommendation and release rule

Implement Tenant RBAC as a sequence of independently deployable, fail-closed slices behind the compatibility modes fixed by issue 11. Do not ship it as one schema/UI cutover. The release authority is a versioned bundle containing the permission registry, the exhaustive issue 13 operation map, the centralized evaluator, contextual-policy implementations, and the migration mode. A bundle is releasable only when its generated permission/operation matrix is complete, all mandatory automated gates below pass, migration verification is clean at a recorded watermark, and the canary has no unexplained widening or isolation mismatch.

Issues 13 and 14 are true direct dependencies of this final handoff and are therefore explicitly included in `Blocked by`. Issue 13 supplies the exhaustive current-operation allowlist and split boundaries needed to generate validation. Issue 14 supplies the non-admin account lifecycle, collision privacy, activation, credential, session, assignment-suspension, and recovery requirements. Omitting either would leave the implementation and acceptance plan incomplete.

Tenant RBAC is universal for active Tenants and receives no Provider-controlled feature key. Provider authorization and Provider-owned School Admin lifecycle remain separate contexts. No release gate may be waived by making authorization permissive: uncertainty, unknown keys, missing relationships, unsupported rollout versions, data-integrity failures, and unavailable authorization storage deny or stop mutation processing.

### 1. Executable sources of truth and generated permission matrix

Create one code-owned permission registry and one machine-readable operation map corresponding exactly to issue 13. The human-readable issue remains the specification; the executable map is its reviewed implementation. Each operation-map row must declare:

- stable operation ID and every concrete page data load, server action, route handler, protected download/export, domain command, or worker entry point it covers;
- exact canonical permission key or an explicit classification as Provider, public/authentication, system policy, or placeholder/no business operation;
- account/Tenant gates (`T`), read/write operational gate (`R` or `W`), entitlement (`MD`, `PPDB-R/W`, `QUIZ-R/W`, or none), contextual policy and allowed arms, sensitive/contact/export projection keys, transaction revalidation requirements, risk class, and expected external denial class;
- required composite permissions, including shared `people.*` plus profile keys and import execution plus destination create/update keys;
- registry version, operation-map version, and lifecycle status.

Generate tests from the registry plus operation map rather than maintaining a handwritten role × route table. The generator must fail CI when:

1. an admitted operation references an absent, malformed, deprecated-for-new-use, removed, dependency-incomplete, or incorrectly classified permission;
2. a registry key has no mapped server enforcement point, except explicitly declared future/system-internal policy entries;
3. an authenticated Tenant action/handler/download/worker is neither mapped nor explicitly classified outside Tenant RBAC;
4. a broad legacy `read`/`write`, `tenantRole`, role name, navigation role array, or entitlement is treated as the final permission decision;
5. a mutation omits `W`, transactional reauthorization, Tenant-qualified target lookup, optimistic/concurrency policy, domain-invariant checks, or atomic audit;
6. a sensitive/contact/document/export projection lacks its supplemental key;
7. a contextual operation lacks a typed policy, canonical relationship, effective-time rule, collection predicate, or concealed detail behavior;
8. a placeholder/demo surface receives a permission, or an actual server-backed operation has none;
9. a `school-admin-only` or `system-internal` key is selectable in a custom role; or
10. registry/map digests differ from the versions activated in a rollout record or migration verification report.

For every map row, generated table-driven tests must exercise: School Admin system policy; each valid custom-role grant; zero roles; missing exact key; dependency-only key; inactive account; pending activation where applicable; draft/archived role; suspended assignment; unknown key; disabled entitlement; read-only Tenant; wrong Tenant; and every declared contextual arm/projection. Tests assert both allow/deny and the correct internal reason while separately asserting the non-disclosing external response.

### 2. Layered validation pyramid

#### A. Pure policy and registry tests

Use the repository's `node:test`/`node:assert` convention (`pnpm test`, implemented by `tsx --test "**/*.test.ts"`) for fast deterministic tests of:

- key grammar, uniqueness, immutable semantics, module/group/order metadata, dependency closure/cycle rejection, risk and assignment classifications, deprecation/replacement rules, template versions, reserved School Admin names, and invalid-key fail-closed behavior;
- additive union and deduplication across multiple active roles, with no deny rules or role-name semantics;
- active/draft/archived role transitions, copy semantics, normalized name uniqueness, permission impact calculation, affected-user count, and optimistic version decisions;
- complete-set assignment replacement, bounded bulk previews (maximum 100), reason requirements, zero-role transitions, entitlement-unavailable explanation, and suspended-assignment restoration filtering;
- evaluator ordering and stable internal reason codes without exposing them to callers;
- contextual tuple logic, effective-time boundaries, deduplication through multiple valid paths, and explicit rejection of Cartesian class/subject combinations, free-text unit scope, creator ownership, or profile-derived authority;
- account and School Admin lifecycle state machines, idempotency fingerprints, token state, coverage calculation, and recovery eligibility;
- audit canonicalization, deterministic local event order, event-key derivation, hash calculation, chain verification, redaction, formula neutralization, and retention projection; and
- migration planning, exact legacy equivalence, mode monotonicity (`intersection ⊆ legacy`; emergency allow is a subset of normal RBAC), checkpoint resume, and rollback eligibility.

#### B. Service/store contract tests

Inject fake stores and clocks to prove every service derives actor and Tenant server-side, recomputes previews on submit, performs the ordered checks from issue 06, never trusts browser-provided actor/Tenant/before-state/diff/count, and sends a complete transaction command to the store. Include fault injection at each mutation/audit/outbox step and assert no partial success.

Every domain wrapper must have a contract test proving it delegates to the centralized evaluator with the exact issue 13 key and contextual policy. Add an architecture/coverage test that inventories exported Tenant actions, handlers, downloads, and worker commands and compares them to the executable operation map. Navigation and control tests may consume the effective snapshot, but must prove UI visibility cannot replace server checks.

#### C. Real MySQL integration tests

Follow the existing `*.mysql.test.ts` convention: run under `pnpm test` when `DATABASE_URL` is present and otherwise skip explicitly. CI's security release job must provide an isolated MySQL database; a run in which mandatory RBAC MySQL tests are skipped is not a passing release gate. Test real constraints, transactions, locks, indexes, and query projections:

- composite Tenant foreign keys and uniqueness prevent cross-Tenant role, permission, assignment, account-person link, School Admin authority, lifecycle case, audit partition, and rollout attachment;
- collection scope is applied in SQL before search, sort, count, facets, pagination, aggregation, print, export, autocomplete, or bulk preview;
- direct records use Tenant-qualified predicates and same-Tenant out-of-scope/cross-Tenant/missing IDs are externally indistinguishable;
- mutation and all required audit events/head updates commit or roll back together;
- role/assignment/account/School Admin versions reject stale writes;
- deterministic lock ordering and roster locking preserve at least one active usable School Admin under concurrent disable, replacement, reactivation, and creation;
- canonical email and one-to-one person-link races produce deterministic, non-enumerating outcomes;
- batch assignment is all-or-nothing; unchanged targets do not produce false child events;
- audit sequences are contiguous, retries create no duplicate events or gaps, command-key fingerprint reuse is rejected, and chain tampering is detected;
- outbox delivery is post-commit and idempotent; failed delivery never grants authority or creates an ambiguous lifecycle state;
- backfill and concurrent compatibility writes converge without duplicate authority/assignment/audit records; and
- workers recheck authority, mode epoch, entitlement/state, target/context, and versions inside the execution transaction.

#### D. HTTP, action, route, and browser tests

For each operation-map surface, test the real entry point—not only the evaluator. Pages, server actions, handlers, downloads, exports, and workers must share the decision. Assert `401` or login redirect for no session, `403` for a same-Tenant principal lacking permission/entitlement or blocked by read-only state, and identical `404` behavior for unknown, foreign-Tenant, and same-Tenant out-of-scope records. Responses, redirects, body shape, headers, file names, timing classes, totals, and error copy must not disclose foreign existence or internal reason codes.

Use Playwright through `pnpm test:e2e`; the current configuration runs Chromium serially (`workers: 1`), with one retry policy in CI, global setup, traces on first retry, and screenshots on failure. Add focused end-to-end flows for the acceptance scenarios below. Browser coverage supplements rather than replaces service/MySQL authorization tests.

#### E. Static and build gates

From `monorepo/`, the required final commands are:

- `pnpm test` with `DATABASE_URL` set so mandatory `*.mysql.test.ts` suites execute;
- `pnpm test:e2e` against an isolated seeded environment;
- `pnpm typecheck`;
- `pnpm lint`; and
- `pnpm build`.

Also run migration verifiers, registry/map coverage generation, audit-chain verification, and final forbidden-reference scans as phase-specific gates. `pnpm test:e2e:list` may validate discovery but is not execution. A passing unit run with skipped database tests, or a passing build without matrix coverage, cannot authorize rollout.

### 3. Tenant isolation and non-enumeration matrix

Use at least two Tenants with intentionally colliding human labels and equivalent records, plus Provider Admin, Applicant, School Admin, active/pending/inactive/zero-role Tenant users, linked/unlinked profiles, and foreign opaque IDs. Parameterize every list/detail/search/autocomplete/export/download/preview/mutation surface over:

- correct Tenant/correct scope;
- correct Tenant/out of contextual scope;
- foreign Tenant ID substituted in route, form, query, body, storage key, relationship, role ID, user ID, case ID, batch ID, or idempotency key;
- unknown ID with the same shape;
- caller-supplied Tenant/actor/email/before-state/diff ignored or rejected; and
- ambiguous or internally inconsistent identity/relationship state.

Required assertions:

- foreign and unknown direct targets have the same status, safe response schema, cache policy, and user copy; telemetry may distinguish only with restricted pseudonymous identifiers;
- account invitation/collision/recovery and School Admin nomination never reveal whether an email belongs to another Tenant, Provider Admin, Applicant, or School Admin;
- foreign rows never influence counts, pagination, ordering gaps, facets, aggregate summaries, candidate matches, printable rows, workbook contents, audit exports, or affected-user previews;
- sensitive/contact fields are omitted or masked server-side, including nested relations, validation errors, candidate data, generated files, and audit payloads;
- protected file paths are server-derived, Tenant-qualified, private/no-store as applicable, and cannot be traversed or substituted;
- Tenant audit partitions, self-history, Provider audit, and denial telemetry have distinct projections and authorization;
- Provider Admin cannot act as a Tenant principal implicitly, and Tenant actors cannot mutate Provider-owned School Admin authority; and
- zero-role users receive only the fixed account/settings/self-history surface and no business data.

Run differential tests that compare the external response for a foreign target with a randomized nonexistent target. Do not require exact wall-clock equality, but set and monitor a bounded latency-distribution difference to detect obvious lookup/enumeration regressions without creating flaky per-request timing assertions.

### 4. Contextual scope validation

For every operation map row declaring `Assigned` or `Self`, provide fixtures for a complete valid path, every missing endpoint, cross-Tenant endpoint, future/expired/suspended/archived relationship, ambiguous duplicate current relationship, and scope loss between preview and commit.

Mandatory scenarios include:

- current Wali Kelas access includes only current eligible class membership; planned/former students are excluded;
- Mathematics/10-A plus Biology/10-B never composes into Mathematics/10-B;
- teacher class+subject delegation remains denied until one canonical teaching-assignment tuple exists;
- nullable free-text `staff_position_assignment.workUnit` never grants unit scope; any unit-scoped operation remains School Admin-only or denied until a canonical unit aggregate exists;
- self scope requires the exact same-Tenant `school_person.accountUserId` link and does not follow email, creator/audit actor, role, or profile type;
- multiple complete paths deduplicate one record/count, and access survives while one complete path remains;
- list/detail/search/autocomplete/export/print/bulk-preview/mutation use identical predicates and effective-time semantics;
- sensitive-field projection is independent from row scope; and
- transaction-time relationship loss aborts the whole mutation, including a bulk mutation, without revealing which concealed target failed.

School Admin's Tenant-wide contextual bypass must be tested as bypassing only ordinary row scope—not Tenant isolation, entitlement/state, sensitive projection, domain invariants, versions, or audit.

### 5. Concurrency, idempotency, and audit-chain validation

Use deterministic barriers/fault injection plus real-MySQL races. At minimum test:

- two editors update one role or assignment set from the same version: exactly one commits, the loser receives a conflict, local UI edits remain recoverable, and no automatic destructive retry occurs;
- role archival/draft transition races assignment creation; no assignment may point to an inactive role and no active role with active assignments may deactivate;
- role permission removal races a holder's mutation; transaction-time authority determines commit, and the next request observes revocation;
- account deactivation races role grant, activation, recovery, and a business mutation; inactive state grants nothing, sessions/tokens are revoked, assignments suspend once, and audit remains coherent;
- two Provider operations attempt to remove the same/last School Admin; locked roster checks preserve `1..n` active usable coverage;
- replacement cutover races cancellation/recovery/disable; the successor grant and selected-incumbent disable are one atomic case-linked transition;
- duplicate browser submission, network retry, callback replay, worker retry, deadlock retry, and outbox redelivery return the committed result without duplicate authority, tokens, email sends, side effects, sequence allocation, or audit events;
- reuse of an idempotency key with another command fingerprint is rejected and security-signaled;
- multi-event transactions allocate the parent first, children sorted by immutable target/event type, then consequence events; sequence and hash links remain contiguous across retries;
- audit insert/head update failure rolls back the business mutation and raises an independent operational alert; telemetry failure never turns a denial into success; and
- periodic verifier detects modified/deleted/reordered events, invalid anchors, gaps, duplicate event keys, and unauthorized retention actions.

### 6. Account and School Admin lifecycle acceptance

#### Non-admin Tenant accounts

Validate create/invite from the directory and from a Warga Sekolah record, optional same-Tenant one-to-one linking, global-email collision privacy, pending activation with staged roles, one-time invitation/temporary credential, resend versus reissue, activation, user-controlled recovery, deactivation, and explicit reactivation assignment choice. Assert:

- profile state never creates/deactivates an account or grants a role;
- temporary secrets have at least 192 bits of CSPRNG entropy, are hash-only at rest, displayed once, absent from URLs/logs/audit/outbox/export, and cannot be retrieved;
- invitation/recovery tokens are random, hashed, purpose/user/Tenant/expiry bound, one-time, and supersede older material;
- activation atomically changes state, establishes credentials, revokes other sessions/material, and audits; first authentication alone is insufficient;
- pending accounts cannot use staged roles; inactive accounts cannot receive grants; deactivation suspends rather than deletes assignments;
- reactivation explicitly chooses zero or a currently valid subset and never silently restores stale roles;
- external email uses a transactional outbox; delivery failure leaves a clear zero-authority/retryable state; and
- forgot-password is not presented as operational until issuer, verified delivery callback, rate limiting, token consumption, and session revocation pass integration/E2E tests.

#### Provider-owned School Admin accounts

Validate roster/view, add, staged replace, non-emergency disable, active-account credential recovery, disabled-account reactivation, cancellation/expiry, and restricted legacy-corruption recovery. Assert separate account-control and authority states; proof alone grants zero authority; pending/disabled nominees do not count as coverage; multiple active School Admins are supported; ordinary disable cannot remove the last; replacement grants successor and disables only the selected incumbent atomically; all relevant sessions/tokens are revoked; Provider reauthentication and mandatory reasons apply; Tenant users cannot invoke any lifecycle operation; and Provider management never creates a Tenant principal for the Provider actor.

### 7. UI, loading, accessibility, and stale/error states

Validate the issue 08 **Akses & Peran** role/account workspace and issue 09 Provider roster/handover workspace at desktop and narrow widths, keyboard-only, screen reader, 200% zoom/reflow, reduced motion, and slow/failing network. Use existing `components/ui` primitives and repository accessibility conventions.

Every noticeable asynchronous operation must show a visible, action-specific loader and programmatic status: route/list/detail skeletons with stable dimensions; retained rows plus `aria-busy` during search/filter/pagination; regional loaders/retries; and pending labels for create/copy/save/activate/archive/restore/assign/bulk/invite/resend/reissue/deactivate/reactivate/recover/handover. Duplicate submission is disabled without freezing unrelated page navigation. Prevent stale search responses from replacing newer results.

Automated component/accessibility tests plus Playwright must cover:

- one `h1`, logical headings, semantic tables/fieldsets/checkboxes/buttons/links, captions or labelled alternatives, visible focus, keyboard ordering, focus trap/restoration, and correctly associated labels/descriptions/errors;
- mixed group-checkbox state and textual dependency/risk/status explanations—not color/icon/disabled state alone;
- polite `role="status"` for progress/success/result counts and `role="alert"` for blocking failures; decorative icons hidden; reduced-motion loaders;
- destructive dialogs initially focus heading/consequence summary, not either action, and cannot dismiss accidentally while submitting;
- separate empty states for no data, no filtered result, zero roles, no effective permissions, no audit, and loading failure;
- preservation of reason/form edits after validation, network, or optimistic conflict; compare/reload/copy options for stale role edits;
- consistent access-denied versus not-found presentation without cross-Tenant disclosure; correlation ID for unexpected failures without raw internals;
- one-time credential acknowledgement/copy flow that cannot redisplay after navigation; and
- effective-access explanation showing source roles, unavailable entitlement, contextual scope, and sensitive risk as separate concepts.

Task-based usability acceptance must include: create from template; resolve dependency removal; edit an active role affecting many users; assign overlapping roles; remove the final role; explain one effective permission; recover from stale edit; inspect a bulk audit chain; invite and activate a non-admin; deactivate/reactivate with explicit assignment choice; add and replace a School Admin; and recover from delivery failure.

### 8. Migration, backfill, canary, emergency mode, and rollback gates

Follow issue 11 exactly: `expand → dual write → backfill → shadow verify → intersection canary → RBAC cutover → contract`. Before each phase, store the source watermark, registry digest/version, issue 13 operation-map digest/version, resolver version, migration build, verification report ID, and approver/change record.

#### Expand/dual-write gate

- Add only additive nullable structures, Tenant constraints/indexes, checkpoints, audit heads, and rollout records; preserve `user.tenant_id` and `user.tenant_role`.
- Route every School Admin and remaining legacy non-admin writer through the compatibility writer. A source scan plus runtime instrumentation must report no unwrapped direct writer.
- Prove old code can run safely against expanded schema and new code in `legacy` mode preserves current decisions.

#### Backfill gate

- Backfill is bounded, resumable, idempotent, deterministic, checkpointed atomically, and safe against concurrent dual writes.
- Unknown/null/malformed/conflicting identity or role states create findings and no grants; templates/profile names are never inferred.
- Every recognized non-admin migration role contains only issue 13 operations demonstrably allowed by that legacy value; School Admin uses dedicated Provider-owned authority.
- Re-running from any checkpoint yields the same graph and no duplicate audit/provenance rows.

#### Shadow/equivalence gate

The repeatable verifier must report zero cross-Tenant references; zero invalid/dependency-incomplete/custom privileged keys; zero active assignments to inactive roles; exact School Admin projection and `1..n` coverage; exact recognized legacy assignments; all consumers/writers classified; and every issue 13 tuple compared after Tenant, R/W, entitlement, exact permission, context, projection, transaction, and invariant gates. There must be **zero RBAC allows where legacy denies**. Legacy-allow/RBAC-deny mismatches must be explained and resolved before that operation/Tenant leaves shadow or intersection.

#### Canary gate

Move internal/test Tenants, then small production cohorts, to `intersection` separately for HTTP and workers before RBAC authority. Promotion requires a defined observation window with zero unexplained allow/deny mismatches, cross-Tenant signals, School Admin coverage violations, next-request revocation failures, worker execution-time failures, audit-chain failures, or lockout indicators. Cohort expansion is manual and evidence-linked; an error-budget breach automatically pauses expansion and queued mutations where needed.

#### RBAC cutover gate

Enable a Tenant only after HTTP and workers independently pass, then disable legacy non-admin mutation before accepting multiple assignments. Keep legacy projections and shadow comparison through the rollback window. Once a Tenant accepts a multi-role-only change, mark legacy rollback forbidden in authoritative state—not an operator note.

#### Emergency mode gate

After multi-role-only state exists, rollback is only to a reviewed immutable `rbac-emergency@version`, never legacy or `legacy OR RBAC`. Test that the deny overlay is provably monotonic-narrowing and cannot add permissions, scope, lifecycle state, entitlement, or School Admin authority. One compare-and-swap rollout record/epoch must atomically control HTTP and workers. Unsupported/stale/missing versions fail closed; claimed workers recheck epoch and authorization in their write transaction and abort/requeue without mutation after a change. Entry and exit require reauthenticated Provider approval, reason, incident ID, expected version/epoch, expiry/review time, policy hashes, impact preview, immutable audit, and the issue 11 exit evidence.

#### Contract/rollback gate

Before contract, prove all Tenants and workers are RBAC-authoritative, no runtime SQL/TypeScript/session/UI reference authorizes from `tenant_role`, School Admin consumers use dedicated authority, dual writes are stopped safely, observation/retention windows elapsed, and backup/restore plus audit-chain verification passed. Drop the legacy column only in a later release. Before multi-role changes, rollback is config/code rollback to legacy with preserved dual-written data; after them, use emergency RBAC. Never collapse role unions, replay audit as authority, delete assignments/history, or restore a stale snapshot as current access.

### 9. Worker and queued-work checks

Treat each worker as a first-class operation-map surface. Enqueue authorization is necessary but never sufficient. For import validation/execution and every future security-sensitive worker:

- derive and store only stable work/correlation IDs and safe requested intent, not an authorization snapshot that can grant later;
- on claim and again inside the mutation transaction, load current rollout epoch/mode, account/Tenant state, School Admin or active assignments, exact permission, destination permissions, R/W and entitlement, contextual scope, target versions, and domain invariants;
- reject revoked/inactive/out-of-scope work without side effects, record bounded failure telemetry/audit as specified, and expose a safe status to the requester;
- use atomic claim semantics, leases/recovery, deterministic idempotency/event keys, and outbox behavior so two workers/restarts cannot double-apply;
- stop mutations if the process does not support the active resolver/registry/map version; and
- include worker results in migration shadow comparison and canary dashboards by operation, mode, version, Tenant cohort, and mismatch direction.

Required races: revoke permission/account/relationship after enqueue; archive role; disable entitlement or Tenant writes; change rollout epoch after claim; duplicate claim; worker crash before/after domain write; audit/outbox failure; stale target; and one invalid item in an atomic batch.

### 10. Observability, alerts, and runbooks

Emit structured metrics/traces/logs with correlation IDs and bounded labels. Never label metrics with email, names, record IDs, secrets, free-text reasons, or unbounded Tenant IDs; use controlled cohort and pseudonymous identifiers in restricted telemetry. Required dimensions include operation key, surface (page/action/handler/download/worker), decision, internal reason, mode, resolver/registry/map version, projection, contextual policy, risk, Tenant cohort, mismatch direction, and latency class.

Dashboards must show:

- authorization allows/denials and rate-limited denial trends;
- `404` concealment categories internally without browser disclosure;
- legacy/RBAC shadow mismatch direction, segmented as issue 11 requires;
- zero-role and inactive-account counts, activation/recovery failures, session/token revocations;
- School Admin active coverage, pending handovers, reconciliation queue, and attempted last-admin removal;
- stale/conflict/idempotent-replay/fingerprint-mismatch rates;
- worker claim/execution authorization failures, epoch/version incompatibility, retries, and queue age;
- audit write failures, chain/head/anchor verification, outbox lag/failure, and retention certificates; and
- migration checkpoints, findings, verifier watermark/version, cohort modes, emergency-mode expiry, and rollback eligibility.

Page Provider security immediately for audit-write/integrity failure, unknown permission in production, unsupported rollout bundle, any RBAC-allow/legacy-deny during pre-cutover comparison, cross-Tenant allow/data leak, zero usable School Admin for an active Tenant, emergency-mode expiry/version mismatch, or a worker committing under a stale epoch. Alert on thresholded repeated cross-Tenant, privileged-boundary, recovery, sensitive-mutation, delivery, lockout, and unexplained-denial events. Telemetry outage never permits an operation.

Provide tested, version-controlled runbooks for:

1. **Unexpected denied access/lockout:** identify correlation ID and safe internal reason; verify account/Tenant/activation, grants, entitlement, context, rollout versions, and data integrity; do not grant a broad role as diagnosis.
2. **Suspected cross-Tenant disclosure:** stop affected operations/cohort, preserve evidence, enter narrowing emergency mode if multi-role state exists, rotate exposed files/tokens as applicable, verify all equivalent surfaces, and follow incident notification policy.
3. **No usable School Admin:** freeze Tenant RBAC mutation, open Provider `recoveryCaseId`, perform out-of-band verification, atomically appoint/reactivate eligible authority, revoke obsolete material, and audit; no shared account/direct DB edit.
4. **Migration mismatch:** pause cohort/backfill, pin watermark and bundle, classify direction, return to legacy only where rollback remains valid, otherwise use emergency RBAC, repair forward, rerun complete equivalence.
5. **Worker authorization/version incident:** pause intake/claims, inspect epoch and in-flight jobs, ensure no stale transaction committed, reconcile idempotently, deploy a supporting bundle, then resume.
6. **Audit-chain or audit-write failure:** stop security mutations for affected context, use independent operational evidence, verify database privileges/backups/anchors, repair forward without rewriting events, and require security approval to resume.
7. **Invitation/recovery delivery incident:** confirm no authority was granted by delivery, pause/retry the idempotent outbox, revoke superseded material, and never expose token contents to operators.
8. **Emergency-mode entry/exit:** use the exact approvals, evidence, hashes, epoch CAS, expiry, shared HTTP/worker behavior, monitoring, and exit criteria from issue 11.

Exercise these runbooks in staging/game days before broad production rollout and after material registry/evaluator/migration changes.

### 11. End-to-end acceptance scenarios

The release evidence must include successful execution and retained artifacts for at least these scenarios:

1. A zero-role active user signs in and sees only **Akses belum diberikan**, account/password/sign-out, and permitted limited self-history; direct business navigation/action is denied.
2. Two active roles union permissions with provenance; entitlement-disabled capabilities are labelled unavailable; removal is visible on the next request without logout.
3. A user can view minimum people data but not contact/sensitive fields; granting each supplemental key changes only that projection.
4. A Wali Kelas sees only current students in their class; totals/search/export match; a foreign, former, and random ID all remain concealed.
5. A teacher's split class/subject assignments cannot form a Cartesian authorization; quiz teacher delegation remains denied without the canonical tuple.
6. A School Admin creates/copies/activates a role, handles dependencies and sensitive confirmation, assigns it atomically, and cannot archive it while active assignments exist.
7. Two admins race role/assignment edits; one wins and one receives a recoverable stale conflict with no lost update or duplicate audit.
8. Bulk assignment with one stale/foreign/ineligible target commits nothing and does not reveal a concealed target; a valid retry writes one summary and deterministic child chain.
9. A non-admin is invited, optionally linked, staged with roles, activated, then deactivated; sessions/material revoke and assignments suspend. Reactivation explicitly selects zero or valid former roles.
10. Same/cross-context email collisions, invite, login, and recovery return generic non-enumerating results and are rate-limited.
11. Provider adds an additional School Admin, completes staged replacement, and concurrent disable attempts cannot leave zero active usable admins; proof alone never grants authority.
12. A permission or contextual relationship is revoked after an import is queued; the worker recheck prevents execution and records the safe outcome.
13. PPDB documents/results and import/generated workbooks enforce exact permission, entitlement, sensitive/export projection, private storage, and concealed Tenant-qualified lookup.
14. Audit mutation failure rolls back authority; normal retry is idempotent; the partition chain verifies across parent/children/consequence events and detects tampering.
15. Backfill resumes after interruption/concurrent writes with identical results; shadow reports no widening; a canary returns safely to legacy before multi-role mutation.
16. After multi-role mutation, simulated incident enters one-epoch narrowing emergency mode for HTTP/workers, blocks stale processes/work, preserves assignments/audit, and exits only with reviewed evidence.
17. Existing authenticated sessions survive schema expansion but authorization always follows current persistence; inactive/revoked users lose access on the next request.
18. Provider Admin, Applicant, public PPDB, and authentication flows retain their separate policies and do not accidentally acquire Tenant permissions.

### 12. Safe incremental implementation slices and gates

Each slice is a reviewable deployment with tests and telemetry; later slices cannot compensate for an earlier missing security gate.

1. **Freeze and executable contract.** Encode registry and issue 13 map, generate coverage/matrix tests, inventory every legacy reader/writer and Tenant entry point, capture baseline decisions/metrics. Gate: exhaustive classification, stable digests, no invented keys.
2. **Additive persistence and constraints.** Add role/permission assignment, dedicated School Admin authority/lifecycle, account lifecycle, provenance/checkpoint, audit head/event, idempotency, outbox, and rollout structures. Gate: migration and real-MySQL constraint/rollback tests; old code remains safe.
3. **Audit/idempotent transaction foundation.** Implement narrow append-only writer, chain, command dedupe, outbox, verifier, and failure alert before security mutation services. Gate: atomicity, tamper, retry, backup/restore tests.
4. **Central evaluator in shadow.** Implement authoritative principal, registry resolution, ordered gates, denial contract, request-local memoization, and legacy/intersection/RBAC modes without changing decisions. Gate: generated matrix and differential/non-enumeration tests.
5. **Provider-owned School Admin compatibility.** Dual-write dedicated authority and migrate Provider queries, provisioning, activation, recovery, roster invariant, and sessions. Gate: issue 09 lifecycle/concurrency/coverage acceptance; no Tenant write path.
6. **Backfill and verifier.** Run deterministic role/assignment backfill from exact legacy permissions plus reconciliation. Gate: all issue 11 invariants clean at fixed watermark and zero widening.
7. **Context and projections.** Implement typed policies and SQL filtering for each delegated issue 13 operation, keeping unsupported teaching/unit delegation denied; split contact/sensitive/export projections. Gate: contextual and two-Tenant matrix per surface.
8. **Convert server operations by vertical slice.** Replace broad guards one resource/feature at a time, including page/query/action/handler/download/worker and exact composite keys. Suggested order: dashboard/settings/users read projection; academic/master-data CRUD; people/profile composites; facilities/activities; imports/workers; PPDB; quizzes. Gate per slice: map coverage, service/MySQL/HTTP tests, no broad fallback.
9. **Role and assignment domain services.** Add lifecycle, templates/copy, complete-set and bulk assignment, impact previews, versions, reasons, and audit. Gate: concurrency/idempotency/privilege-escalation tests; server APIs first, no UI-only authority.
10. **Non-admin account lifecycle.** Add invite/temp fallback/link/activation/recovery/deactivate/reactivate/outbox and role handoff. Gate: issue 14 collision privacy, token/session, partial-failure, loading, and E2E acceptance.
11. **Tenant Akses & Peran UI.** Implement issue 08 role/account/effective-access/audit UI with exact server snapshots, accessibility, loaders, stale handling, and responsive behavior. Gate: component accessibility, Playwright tasks, direct-call denial.
12. **Provider School Admin UI.** Implement issue 09 roster/handover/recovery/audit views over already-enforced services. Gate: Provider reauthentication, non-enumeration, coverage previews, loaders/accessibility, concurrent stale E2E.
13. **Intersection canary and RBAC rollout.** Progress cohorts using measured gates; cut HTTP and workers only after independent evidence; enable multi-role mutation only after legacy mutation is disabled. Gate: observation window and rollback/emergency rehearsal.
14. **Contract cleanup.** Remove authorization/session/UI dependence on singular role, stop dual writes, observe, then later drop legacy storage. Gate: forbidden-reference scan, all-Tenant/worker authority, clean chain/backups, no legacy rollback dependency.

A slice may ship dark or in `legacy`/shadow mode when its schema and code are backward-compatible. Tenant-facing mutation UI must not ship before its server enforcement, transaction/audit foundation, migration state, and rollback classification are ready. The implementation is complete only when every issue 13 operation is enforced or explicitly remains denied/outside scope, issue 14 is operational end to end, and no legacy role/menu/client state can grant authority.

### 13. Final ship checklist and decision

Tenant RBAC may ship broadly only when all of the following are evidenced:

- generated registry × operation-map coverage is complete and version-matched;
- all required unit/service/MySQL/HTTP/Playwright/accessibility/type/lint/build gates pass with no mandatory database suite skipped;
- two-Tenant isolation/non-enumeration and contextual collection/detail/projection tests pass for every mapped surface;
- next-request grant/revocation and execution-time worker checks pass with existing sessions;
- role, assignment, non-admin account, and Provider School Admin lifecycle concurrency/idempotency/audit invariants pass;
- audit mutation atomicity, chain verification, anchoring, redaction, retention, backup restoration, and alerting are operational;
- migration verification is clean at a current watermark, canary mismatch/error budgets are met, and rollback eligibility is recorded per Tenant;
- shared HTTP/worker emergency mode has been rehearsed and cannot widen access;
- dashboards, alerts, support correlations, and all eight runbooks are tested and owned; and
- acceptance scenarios 1–18 pass with artifacts linked to the release bundle.

**Decision:** proceed with implementation only through the gated slices above. Do not perform a big-bang replacement, do not authorize by `legacy OR RBAC`, do not infer roles from profiles/templates/navigation, and do not relax Tenant/context/audit checks for availability. The safe release posture is additive persistence, generated exhaustive coverage from issues 03 and 13, server-authoritative per-request/per-worker enforcement, explicit account and School Admin lifecycles from issues 14 and 09, transactional tamper-evident audit from issue 10, and the canary/emergency/rollback model from issue 11.
