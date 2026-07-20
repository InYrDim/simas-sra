# Plan the Master Data implementation sequence and validation

Type: grilling
Status: resolved
Blocked by: 08

## Question

What incremental implementation sequence, migration and seed strategy, production rollout safeguards, and automated/manual validation plan should deliver the nine Tenant Master Data pages and the Siswa/Guru/Staf import workflow while preserving Tenant isolation, authorization, lifecycle history, and safe rollback at every step?

## Answer

### Delivery strategy

- Deliver Master Data incrementally through deployment-safe vertical slices, Tenant-scoped feature flags, and evidence-based rollout gates.
- A deployment may install dormant schema and code, but no Tenant sees or mutates a stage until its flags are enabled and its exit criteria pass.
- Separate read and write flags for every rollout group. Import additionally separates template download, upload/validation, and execution flags so risky mutations can stop without removing prior results.
- Menu visibility follows enabled read capabilities, but routes, server actions, handlers, repositories, and workers independently enforce authorization, Tenant lifecycle, and feature state.
- Build shared abstractions only after at least two vertical slices demonstrate the same requirement. Do not begin with a generic Master Data framework that guesses across all entities.

### Functional rollout order

Implement and activate in this dependency order:

1. **Shared foundation** — Tenant authorization guard, feature-flag evaluation, audit vocabulary, optimistic concurrency support, server pagination/query conventions, lifecycle primitives, file/object-storage boundary, background-job boundary, and reusable accessibility/UX primitives.
2. **Profil Sekolah and Tahun Ajaran** — establish the single-record form contract, Provider/read-only identity boundary, managed asset flow, effective-dated academic periods, explicit forward-only transitions, and audit/conflict handling.
3. **Mata Pelajaran and Rombongan Belajar** — add stable catalogs, year-scoped class groups, effective-dated memberships, Wali Kelas assignments, relationship blockers, and history presentation.
4. **Siswa, Guru, and Staf without import** — add shared Warga Sekolah identity, role-specific profiles, strict identifiers, duplicate review for manual creation, lifecycle histories, account-status display, and non-destructive archive/reactivation.
5. **Sarana & Prasarana** — add Location hierarchy, grouped/individual Assets, quantity/condition/location histories, and referential blockers.
6. **Organisasi & Ekstrakurikuler** — add stable identities, leadership/membership histories, yearly activity groups, and their lifecycle constraints.
7. **Siswa/Guru/Staf import** — add versioned templates, durable validation jobs, spreadsheet review, identity decisions, correction revisions, partial row-atomic execution, retry, and result reconciliation.
8. **`/master` overview** — enable only after its underlying queries and exception definitions are authoritative; every metric and task links to an existing filtered operational page.

- A later group may be developed before an earlier group reaches general rollout, but it cannot bypass unmet data or lifecycle dependencies.
- Profil Sekolah does not block unrelated catalogs after the common foundation. Import does block on all people write paths and their production invariants.

### Shape of each vertical increment

For every rollout group, deliver these independently deployable steps:

1. Additive schema migration and indexes.
2. Tenant-scoped repository queries and database constraint tests.
3. Domain services, input validation, lifecycle rules, concurrency, and audit.
4. Read API/UI behind the read flag.
5. Write API/UI behind the write flag.
6. Verification and reconciliation scripts.
7. Unit, integration, route, E2E, accessibility, and manual acceptance evidence.
8. Internal/demo activation, then Tenant pilot, then a small cohort, then general activation as each evidence gate passes.

Each step must leave the preceding production version operable. Avoid a pull request or deployment that combines schema for every domain with all backend and UI work.

### Migration policy

- Use expand/backfill-or-bootstrap/verify/activate/contract. The initial release is primarily expand because dedicated Master Data tables do not yet exist.
- Migrations are additive and backward-compatible with the previously deployed application. Do not rename/drop columns, drop tables, reinterpret stored values, or add blocking constraints in the same deployment that introduces their replacement.
- Add nullable columns or new tables first, populate only authoritative values, verify, then introduce stricter application behavior. A later migration may enforce database constraints after verification proves all rows comply.
- Every operational table carries explicit Tenant ownership. Unique constraints include `tenantId` where uniqueness is Tenant-local. Relationship integrity must make cross-Tenant links impossible through composite ownership constraints or equivalent transactionally enforced design.
- Effective-dated and lifecycle histories are append-preserving. Migration and repair scripts do not rewrite history into only a current snapshot.
- Schema migrations have a production preflight, bounded lock/statement behavior, observable progress, and post-migration verification. Large index or constraint work uses the database’s safe online strategy where available.
- Do not use destructive down migrations as routine rollback. Roll back application code and disable feature flags while retaining schema and committed Master Data.
- Contract migrations occur only after the old application/write path is retired, all data is verified, and rollback no longer depends on the old representation.

### Bootstrap and seed strategy

- Production receives no sample Siswa, Guru, Staf, Mata Pelajaran, Rombel, facilities, organizations, extracurriculars, or academic periods.
- Provider-owned NPSN, domain, Nama Resmi Sekolah, and Tenant identity remain read from their authoritative source and are not copied into editable Master Data seeds.
- Profil Sekolah may receive an empty Tenant-bound operational record, created lazily or by an idempotent bootstrap, but no address, contact, logo, display name, or history is invented.
- The first Tahun Ajaran is created explicitly by School Admin; the system does not infer it from the calendar.
- Closed structured choices are stable application/schema codes rather than Tenant-editable seed rows.
- Development, tests, demos, and load checks use deterministic fixture factories clearly separated from production migrations. Fixtures include multiple Tenants, archived records, lifecycle histories, identifier collisions, relationship blockers, and import edge cases.
- Every bootstrap or backfill command supports `audit`/dry-run, `apply`, and `verify`, is resumable and idempotent, reports counts by Tenant without logging sensitive values, and fails closed on ambiguous source data.

### Import job architecture

- Upload stores the protected workbook and creates a Tenant-scoped Batch Impor Orang; parsing and validation run as a durable background job rather than an HTTP request.
- School Admin reviews the immutable validation revision and records identity decisions in the UI. Confirmation enqueues a durable execution job bound to Tenant, batch, revision, and selected row set.
- Workers assume at-least-once delivery. Row success markers are committed in the same transaction as Warga Sekolah/profile/history/audit writes; restart and retry skip committed rows.
- Jobs persist state, checkpoints, attempts, stable error codes, and aggregate outcomes. UI can reload and resume by polling status; browser/session lifetime does not control job lifetime.
- Worker start/resume rechecks batch Tenant, current actor authority, Tenant lifecycle, feature flags, template support, row validity, uniqueness, and matched-record eligibility.
- Disabling upload/validation rejects new work without hiding prior results. Disabling execution prevents new row commits. Emergency stop lets the current database transaction finish, then prevents the worker from claiming the next row.
- Original files and correction/result workbooks use Tenant-scoped protected storage, content/malware checks, encryption, access controls, and explicit retention. Cell payloads never enter generic logs.

### Automated validation

- **Unit tests:** normalization, structured values, identifier formats, domain validation, lifecycle state machines, date overlap, archive/reactivation decisions, duplicate classification, template versioning/parsing, finding codes, permission predicates, and overview exception definitions.
- **MySQL integration tests:** repositories against disposable real MySQL; Tenant-scoped uniqueness; composite ownership; foreign keys; transactions; row locks; concurrent updates; effective-dated histories; archive blockers; import row atomicity; idempotent job retry; and migration/bootstrap/repair script behavior.
- **Authorization/route tests:** unauthenticated redirects, matching School Admin success, other-role `403`, unknown/cross-Tenant `404`, read-only Tenant states, archived-record restrictions, stale role/lifecycle state, prohibited Provider fields, malformed queries, and direct URL/server-action access independent of menu visibility.
- **Component/UI tests:** URL-backed search/filter/sort/page/selection, empty versus zero-result states, form error summary and focus, conflict preservation, confirmation wording, disabled/read-only explanations, archive/reactivation blockers, and import review decisions.
- **Browser E2E:** critical create/read/edit/lifecycle/archive/reactivate paths for each entity group; responsive list/detail behavior; overview deep links; keyboard operation; import upload-through-result including reload/retry; and a second Tenant proving isolation.
- **Accessibility:** automated axe checks on representative states plus manual keyboard, focus-return, screen-reader announcement, zoom/reflow, contrast, reduced-motion, and mobile touch-target checks.
- CI runs unit, MySQL integration, and authorization/route tests for every relevant change. Browser smoke tests gate deployment; full E2E and accessibility suites gate pilot/general activation.
- Mocks are allowed for external services and deliberately induced failures, not as proof that SQL constraints, transactions, Tenant isolation, or durable retry work.

### Reconciliation and invariant checks

Provide read-only verification commands that fail the rollout gate when they find:

- Missing/unknown Tenant ownership or any relationship crossing Tenant boundaries.
- Duplicate Tenant-local NIK, NIP, NIS, NISN, NUPTK, internal Guru number, internal Staf number, or other entity keys.
- Overlapping lifecycle/effective-dated periods, conflicting active Rombel membership, conflicting Wali Kelas assignment, or invalid academic-period activation.
- Archived records used in prohibited new relationships or active relationships that should block archive.
- Lifecycle/current state without corresponding history and audit actor/time.
- Batch/revision/execution ownership mismatch; a successful import row without its success marker and result records; duplicate success; or aggregate counts inconsistent with row outcomes.
- Import-created Akun Pengguna or role assignment.
- Overview metrics that disagree with their underlying filtered entity query.

Verification reports safe aggregate counts and internal identifiers for investigation, never sensitive row payloads. It never silently repairs. Repair uses a separate reviewed, idempotent command with dry-run, apply, verify, audit reason, and preserved history.

### Manual validation matrix

For each entity group and rollout cohort, School Admin acceptance covers:

- First-use empty state, creation, detail, editing, validation failure, save success, concurrency conflict, search, filter, sorting, pagination, deep link, browser back, and mobile layout.
- Every allowed lifecycle transition plus prohibited transitions, required dates/reasons, relationship blockers, archive, archived read-only behavior, and reactivation without restoring old relationships.
- Tenant lifecycle states: active/trial mutation, expired-trial read-only/template policy, suspended read-only policy, closed denial, and unknown-state fail-closed behavior.
- Security scenarios with direct URLs, tampered record/candidate IDs, another Tenant/domain, non-School-Admin roles, stale sessions, and revoked authority.
- Domain-specific histories and relationships for Profil Sekolah, academic references, people, facilities, and activities.
- Import fixtures containing valid rows, every hard identifier collision, similarity warnings, archived identity, existing Warga Sekolah without the target profile, invalid values, correction revision, skip decisions, concurrent conflict, partial completion, worker restart, duplicate confirmation request, and downloadable results.
- Read-only and mutation monitoring, audit visibility, support reference behavior, and reconciliation immediately after the scenario set.

### Evidence-based rollout gates

There is no minimum waiting period measured in days. Advance as soon as evidence is complete:

1. **Internal/demo gate:** migration preflight, automated suites, reconciliation, manual smoke tests, observability, backup verification, and rollback/emergency-stop drill pass.
2. **Tenant pilot gate:** one consenting pilot completes all critical paths applicable to the group; reconciliation remains clean; no unresolved high-severity defect or support blocker exists.
3. **Import pilot gate:** at least one representative batch for each of Siswa, Guru, and Staf demonstrates valid creation/linking, warning decisions, rejected rows, correction revision, reviewed partial execution, worker retry/restart, idempotency, and result reconciliation.
4. **Small-cohort gate:** authorization, error, job, database, and reconciliation monitoring remains healthy under broader use; support feedback reveals no high-severity workflow defect.
5. **General activation:** all preceding evidence remains valid and the rollback/emergency controls are still operable.

Read-only capabilities may advance independently of write capabilities. A later group can continue development while a prior group is still gated, but it cannot be activated across an unmet dependency.

### Observability and stop conditions

- Record structured metrics for authorized/denied operations, latency/error by operation, database constraint/conflict outcomes, archive blockers, job queue age/attempts, import row outcomes, reconciliation violations, and feature-flag cohort—without sensitive cell or personal payloads.
- Correlate request, audit, batch, execution, and job identifiers. Security events follow the established authorization contract.
- Immediately stop affected writes and cohort expansion on any suspected cross-Tenant read/write, unauthorized mutation, missing/corrupted lifecycle history, import double-commit, unexplained duplicate identifier, destructive migration behavior, or unreconciled data loss.
- Other high-severity defects stop expansion and disable the narrowest affected write/import flag while preserving read access where safe.
- A rollback runbook names the flag change, worker stop, application rollback, verification commands, affected-record query, communication owner, and reactivation criteria.

### Recovery and rollback

- Before risky migrations, verify encrypted backups and point-in-time recovery through a restore drill in an isolated environment.
- Routine feature rollback disables writes/import execution and rolls back the application to a schema-compatible version. It does not drop tables or restore the global database.
- A global restore is disaster recovery only because it could erase valid writes from unaffected Tenants.
- If faulty code committed invalid data, identify the affected Tenant/records through deployment window and audit/job identifiers, then run a reviewed targeted repair. Corrections append audit/history with incident reason rather than erasing evidence.
- After rollback or repair, run the complete relevant reconciliation and critical-path smoke suite before re-enabling any write flag.
