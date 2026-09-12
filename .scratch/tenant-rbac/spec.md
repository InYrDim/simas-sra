# Tenant RBAC

Status: ready-for-agent

## Problem Statement

SIMAS saat ini mengikat satu `tenant_role` pada setiap Akun Pengguna dan sebagian besar otorisasi Tenant pada praktiknya membedakan School Admin dari pengguna lain. Banyak operasi server memakai guard `read`/`write` yang luas, sementara beberapa halaman dan menu hanya menyaring berdasarkan role di sisi presentasi. Feature entitlement, keadaan operasional Tenant, Permission Tenant, dan cakupan data kontekstual juga belum dipisahkan secara konsisten.

Kondisi ini tidak cukup untuk sekolah yang perlu membagi kewenangan secara aman kepada Pimpinan, Guru, Staf, Siswa, Tamu, dan role khusus tanpa menjadikan mereka School Admin. Menambah role string baru tidak menyelesaikan masalah karena nama role tidak dapat menjadi sumber authority, satu pengguna dapat memerlukan beberapa role, dan kewenangan atas suatu operasi masih harus dibatasi oleh hubungan domain seperti Wali Kelas, penugasan mengajar, unit, atau catatan milik sendiri.

School Admin membutuhkan cara untuk menyusun Role Tenant dari katalog kemampuan yang dikendalikan sistem, menetapkan beberapa role kepada Akun Pengguna non-admin, memahami effective access, dan meninjau riwayat perubahan. Provider Admin juga membutuhkan lifecycle School Admin yang aman tanpa mencampurkan konteks keamanan Provider dan Tenant. Migrasi dari model singular tidak boleh memperluas akses, memutus sesi aktif, membuat Tenant tanpa School Admin, atau kehilangan kemampuan rollback yang aman.

## Solution

SIMAS akan menyediakan RBAC universal bagi seluruh Tenant aktif. Setiap Akun Pengguna non-admin dapat memegang nol atau lebih Role Tenant aktif. Effective access adalah gabungan aditif Permission Tenant dari semua assignment aktif, tanpa deny rule dan tanpa menafsirkan nama role atau profil Warga Sekolah sebagai authority.

Permission Tenant berasal dari registry version-controlled dengan key stabil berbentuk `<module>.<resource>.<action>`. School Admin dapat menyusun custom role hanya dari permission berklasifikasi `tenant-assignable`. Kemampuan administrasi keamanan dan lifecycle akun tertentu berklasifikasi `school-admin-only`, sedangkan kebijakan internal tidak ditampilkan sebagai pilihan role.

Satu evaluator server-owned menjadi sumber keputusan otorisasi untuk halaman, server action, route handler, download, export, dan worker. Evaluator memuat ulang state authority yang persisten pada setiap request atau eksekusi worker, sehingga perubahan grant berlaku pada request berikutnya tanpa logout. Evaluator memisahkan autentikasi, Tenant isolation, keadaan akun dan Tenant, feature entitlement, exact permission, contextual data policy, sensitive projection, serta domain invariant. Semua kondisi yang tidak dikenal atau tidak konsisten gagal tertutup.

RBAC menentukan operasi apa yang boleh dicoba. Contextual policy menentukan record mana yang berada dalam cakupan. School Admin dapat melewati kebijakan contextual yang lebih sempit, tetapi tidak dapat melewati Tenant isolation, entitlement, sensitive projection, read-only state, domain invariant, concurrency check, atau audit. Custom role tidak dapat memperoleh generic Tenant-wide scope; suatu operasi hanya Tenant-wide apabila kebijakan code-owned operasi tersebut memang demikian.

School Admin mengelola Role Tenant dan assignment melalui area **Akses & Peran**. Provider Admin mengelola roster dan lifecycle School Admin melalui konteks Provider yang terpisah. Authority School Admin tidak direpresentasikan sebagai custom Role Tenant dan tidak dapat dibuat, dipindahkan, atau dicabut oleh pengguna Tenant.

Perubahan keamanan dicatat secara transaksional dalam audit append-only yang tamper-evident. Migrasi dilakukan bertahap melalui mode legacy, shadow, intersection, RBAC, dan emergency narrowing. Sistem tidak pernah mengotorisasi dengan `legacy OR RBAC`.

## User Stories

1. As a School Admin, I want to see all Role Tenant in my Tenant, so that I can understand how access is organized.
2. As a School Admin, I want to create a draft Role Tenant from scratch, so that I can model a school-specific responsibility.
3. As a School Admin, I want to create a draft role from a Template Role Tenant, so that I can start from a safe system-provided recipe.
4. As a School Admin, I want to copy an existing active role without copying assignments, so that I can create a variation safely.
5. As a School Admin, I want role names to be unique after normalization, so that users and audit history are not ambiguous.
6. As a School Admin, I want reserved variants of School Admin to be rejected as role names, so that a custom role cannot impersonate system authority.
7. As a School Admin, I want permissions grouped with Indonesian labels and descriptions, so that I can understand business capabilities without interpreting technical routes.
8. As a School Admin, I want permission dependencies selected and locked automatically, so that I cannot save an invalid role composition.
9. As a School Admin, I want sensitive and critical permissions highlighted, so that I can make informed privilege decisions.
10. As a School Admin, I want an impact preview before editing an active role, so that I can see affected users and permissions gained or lost.
11. As a School Admin, I want stale role edits rejected without losing my local changes, so that concurrent administrators do not overwrite one another.
12. As a School Admin, I want to activate only a valid role with at least one assignable permission, so that incomplete drafts grant no access.
13. As a School Admin, I want to move an active role to draft or archive only after its active assignments are removed or migrated, so that access is not silently revoked in bulk.
14. As a School Admin, I want an archived role restored as an unassigned draft, so that history is preserved without silently restoring authority.
15. As a School Admin, I want to find eligible non-admin Akun Pengguna by name, email, linked Warga Sekolah, profile kind, role, and account state, so that I can administer access efficiently.
16. As a School Admin, I want to assign multiple active roles to one eligible account atomically, so that partial access changes cannot occur.
17. As a School Admin, I want to see the deduplicated effective permissions and every source role, so that I can explain why an account has access.
18. As a School Admin, I want unavailable feature capabilities labelled **Tidak tersedia untuk Tenant**, so that entitlement is not confused with role composition.
19. As a School Admin, I want to revoke an account's final role with an explicit warning and reason, so that zero-role access loss is intentional.
20. As a School Admin, I want to add or revoke one role across a bounded batch of accounts atomically, so that bulk administration is predictable and auditable.
21. As a School Admin, I want invalid or stale targets to fail the entire batch without revealing foreign Tenant identities, so that isolation is preserved.
22. As an active zero-role user, I want to sign in and see **Akses belum diberikan**, account settings, school identity, password management, limited self-history, and sign-out, so that I am not mistaken for a broken account while receiving no business data.
23. As a Tenant user, I want permission changes to apply on my next request without logout, so that revocations take effect promptly.
24. As a Tenant user, I want UI navigation and controls to match my effective access, so that unavailable actions are not misleading.
25. As a Tenant user, I want direct navigation and server operations denied consistently when I lack permission, so that hidden UI is never the security boundary.
26. As a Tenant user, I want sensitive contact, document, and export data protected by explicit supplemental permissions, so that ordinary view access reveals only the operational minimum.
27. As a Wali Kelas with the required permission, I want access limited to currently eligible members of my assigned Rombongan Belajar, so that authority follows current domain relationships.
28. As a Guru with multiple assignments, I want only complete class-and-subject assignment tuples considered, so that unrelated assignments cannot combine into broader access.
29. As a Tenant user with self access, I want it resolved through my same-Tenant Akun Pengguna link to Warga Sekolah, so that email, creator identity, or profile type cannot imply ownership.
30. As a Tenant user, I want lists, totals, search, pagination, autocomplete, exports, and bulk previews filtered before result construction, so that out-of-scope records cannot leak indirectly.
31. As a School Admin, I want to create or invite a non-admin Akun Pengguna and optionally link it to one same-Tenant Warga Sekolah, so that identity and application access remain distinct.
32. As a School Admin, I want email collisions handled without disclosing another Tenant, Provider Admin, Applicant, or School Admin identity, so that account discovery cannot become enumeration.
33. As a School Admin, I want to resend still-valid invitation material without rotating it, so that delivery can be retried idempotently.
34. As a School Admin, I want to reissue activation material by revoking and replacing previous material, so that compromised or expired material cannot be reused.
35. As a School Admin, I want to deactivate a non-admin account, revoke its sessions, and suspend rather than delete its assignments, so that access stops while history remains.
36. As a School Admin, I want reactivation to require an explicit choice of zero or currently valid former roles, so that authority is never restored silently.
37. As an account holder, I want activation and recovery secrets to be one-time, expiring, and absent from logs and audit, so that credential delivery does not expose reusable secrets.
38. As a Provider Admin, I want to see every Tenant's current, pending, and disabled School Admin roster, so that I can maintain administrative coverage.
39. As a Provider Admin, I want to nominate an additional School Admin whose proof of account control grants no authority by itself, so that identity proof and authority remain separate.
40. As a Provider Admin, I want to grant School Admin authority only after reauthentication and valid proof, so that privileged changes require current Provider authorization.
41. As a Provider Admin, I want replacement cutover to atomically grant the successor, disable the selected incumbent, revoke incumbent sessions and tokens, validate coverage, and audit the change, so that no premature or unmanaged authority state occurs.
42. As a Provider Admin, I want an active Tenant to retain at least one active usable School Admin while permitting multiple active School Admins, so that administration remains available without imposing an artificial maximum.
43. As a Provider Admin, I want recovery to distinguish account-control proof from authority reactivation, so that credential recovery cannot silently restore authority.
44. As an authorized auditor, I want to inspect role, assignment, account, School Admin, migration, and security lifecycle events, so that changes are explainable.
45. As an account holder, I want a safe limited view of my own account and role history, so that I can understand access changes without receiving Tenant-wide audit authority.
46. As a security operator, I want audit events ordered, hash-linked, redacted, and externally anchored, so that tampering can be detected.
47. As a security operator, I want business mutations to roll back when mandatory audit persistence fails, so that unrecorded authority changes cannot succeed.
48. As a migration operator, I want recognized legacy non-admin roles backfilled to an exact frozen permission set, so that migration preserves current access without inventing new capabilities.
49. As a migration operator, I want unknown, malformed, null, or conflicting legacy states to create findings and no grants, so that uncertainty fails closed.
50. As a migration operator, I want shadow comparison to prove there are no RBAC allows where legacy denies, so that rollout cannot widen access unnoticed.
51. As a migration operator, I want HTTP and worker cohorts promoted separately through intersection before RBAC authority, so that queued work cannot bypass migration controls.
52. As an incident responder, I want an immutable versioned emergency RBAC mode that can only narrow effective access, so that incidents after multi-role adoption do not require unsafe legacy projection.
53. As a worker operator, I want queued jobs to recheck current authority, entitlement, context, rollout epoch, and target state inside their execution transaction, so that enqueue-time permission cannot survive revocation.
54. As a support operator, I want correlation IDs and safe internal denial reasons, so that access incidents can be diagnosed without exposing security state to users.
55. As a keyboard or screen-reader user, I want role, assignment, account, and School Admin workflows to provide semantic controls, focus management, status announcements, and non-color-only meaning, so that security administration is accessible.
56. As any administrator, I want visible action-specific loading indicators and duplicate-submit prevention for noticeable asynchronous work, so that I know whether a security-sensitive command is processing.

## Implementation Decisions

- Tenant RBAC is universal for active Tenants and does not use a Provider-controlled feature gate.
- Provider authorization remains a separate security context. Provider Admin identity is established through its dedicated linked identity and never through a Role Tenant.
- School Admin is a Provider-owned system authority scoped to one Tenant. It is not a custom role, cannot be delegated by Tenant users, and supports `1..n` active usable authorities for an active Tenant.
- An Akun Pengguna non-admin may hold multiple Role Tenant assignments. Grants combine additively; no generic deny or mutual-exclusion engine is introduced.
- Warga Sekolah and Profil Siswa, Profil Guru, or Profil Staf describe a person. They never create application authority automatically.
- Role kinds are School Admin system authority, versioned Template Role Tenant recipes, and Tenant-owned custom Role Tenant records.
- Custom role lifecycle is `draft`, `active`, or `archived`. Draft and archived roles grant nothing. Tenant users cannot hard-delete roles.
- Role identity is immutable; names are normalized and unique within a Tenant. Archived roles retain their names until explicitly renamed.
- Role and assignment mutations use optimistic versions, impact previews, authoritative recomputation on submit, mandatory reasons for risky outcomes, and atomic audit.
- Permission keys follow stable English lowercase-kebab-case `<module>.<resource>.<action>` naming. Indonesian labels, descriptions, grouping, and ordering are metadata.
- The code-owned permission registry stores dependencies, risk, assignment classification, lifecycle status, and replacement keys. Unknown, malformed, removed, or invalid keys grant nothing.
- Registry assignment classes are `tenant-assignable`, `school-admin-only`, and `system-internal`. School Admin-only keys cannot be placed in custom roles.
- Released permission keys are never reused with another meaning. Semantic changes create new keys and explicit migration metadata.
- A permission enters the executable registry only when its enforcing endpoint, centralized check, audit behavior, and tests ship together.
- The executable operation map covers every authenticated Tenant page load, server action, route handler, protected download/export, domain command, and worker entry point, or explicitly classifies it outside Tenant RBAC.
- The centralized server evaluator is the primary authorization seam. It derives authority from the session user ID and authoritative persistence on every protected request; session role fields, cookies, JWT claims, navigation state, and client state are not authority sources.
- Request-local memoization is allowed. Cross-request permission caching and permission-bearing JWTs are excluded from the initial design.
- Evaluation order is authentication, active persisted account, domain-to-Tenant resolution, exact Tenant membership, identity-kind rejection, activation state, Tenant operational state, feature entitlement, known exact permission, effective permission membership, contextual policy, then domain and concurrency invariants.
- Missing authentication redirects pages or produces `401` for applicable APIs. Foreign Tenant, missing record, and contextual scope denial are externally concealed as `404`. Same-Tenant missing permission, disabled entitlement, read-only restriction, and invalid permission configuration produce safe `403` responses.
- Internal denial reasons are structured for telemetry but do not expose foreign existence, role composition, or detailed identity state to the browser.
- Sensitive mutations revalidate actor, Tenant, account, role, assignment, registry, entitlement, context, versions, and bulk targets inside the transaction. Browser-provided actor, Tenant, before-state, diff, or affected count is never authoritative.
- RBAC capability and contextual data scope are independent. Contextual policies are typed code-owned policies such as Assigned, Unit, Self, or intrinsically Tenant-wide.
- School Admin is the only bypass for an otherwise narrower contextual policy. This bypass never crosses Tenant isolation or other independent gates.
- Collection scope is applied in persistence queries before search, ordering, counts, facets, pagination, aggregation, printing, export, autocomplete, or bulk preview.
- Direct foreign-Tenant, same-Tenant out-of-scope, and nonexistent records are externally indistinguishable.
- Teacher class-and-subject authority requires a canonical complete assignment tuple. Free-text unit values and creator/audit identity never grant contextual access.
- The **Akses & Peran** Tenant UI has separate Role and Akun Pengguna destinations, using responsive list/detail workspaces rather than a users-by-roles matrix.
- UI previews are explanatory only. Server recomputation determines all commits.
- Zero-role accounts are valid and receive only the fixed no-access/account surface.
- Single-user assignment replaces the complete active role set atomically. Bulk assignment is initially bounded to 100 targets and is all-or-nothing.
- Inactive account assignments are suspended rather than deleted. Reactivation never silently restores them and does not use feature entitlement as role eligibility.
- Account invitation resend redelivers the same still-valid material without changing its digest or expiry. Reissue revokes and replaces prior material.
- User-owned login, password change, invitation consumption, email verification, ordinary recovery, MFA/passkey, and session management remain authentication policy rather than Tenant RBAC operations.
- School Admin lifecycle uses independent `authorityState: none | active | disabled` and `proofState: pending | completed | expired | cancelled` dimensions.
- Canonical School Admin lifecycle events distinguish nomination, account-control proof, authority grant, authority disable, atomic replacement cutover, recovery proof, and authority reactivation. Proof events alone never change authority.
- All security mutations and mandatory audit events commit in one transaction. Audit failure rolls back the mutation.
- Audit is append-only and partitioned by security context. A locked sequence/head row allocates deterministic contiguous event ordering and hash links. Stable command/event idempotency keys prevent duplicates across retries.
- Audit views are scoped separately for Tenant School Admin, affected-user self-history, Provider Admin, and restricted security operations. Secrets and unnecessary personal data are excluded or redacted; exports are formula-safe.
- Migration follows `expand → dual write → backfill → shadow verify → intersection canary → RBAC cutover → contract`.
- Migration never uses `legacy OR RBAC`. Before cutover, intersection may only narrow legacy access.
- Every recognized legacy non-admin role receives exactly the frozen current-access permissions established by the operation map; every other permission is denied. Unknown or conflicting states receive no grant.
- School Admin migrates to dedicated Provider-owned authority rather than a Tenant custom role.
- Existing sessions may survive schema expansion, but each request and worker execution resolves current persisted authority.
- Once a Tenant accepts multi-role-only state, rollback to singular legacy authority is forbidden. Emergency response continues reading RBAC and applies an immutable versioned deny-only overlay controlled by a shared HTTP/worker epoch.
- Tenant-facing UI is not enabled before server enforcement, transactional audit, migration state, and rollback classification for its operations are ready.
- Noticeable asynchronous UI operations always show an action-specific loader, expose programmatic status, prevent duplicate submission, preserve safe user input on failure, and avoid stale response replacement.
- Dialogs and sheets have programmatic title/description, trapped and restored focus, safe destructive initial focus on the consequence heading, keyboard dismissal before submission, and status/error announcements.

## Testing Decisions

- Tests assert external behavior and security contracts rather than private implementation details. Role names, SQL shape, component internals, and storage layout are not asserted unless they are themselves a required public or integrity contract.
- The highest and primary seam is the centralized authorization evaluator. Generated table-driven tests cover every registry and operation-map combination through this seam.
- The second seam is the security mutation service contract. Tests use controlled stores, clocks, and fault injection to verify server-derived identity, transaction commands, revalidation, optimistic concurrency, idempotency, audit atomicity, and rollback.
- A smaller number of real entry-point tests prove pages, server actions, route handlers, downloads, exports, and workers delegate to the centralized evaluator with the exact operation and contextual policy.
- Pure policy tests cover key grammar, dependency closure, assignment classification, role lifecycle, additive unions, assignment replacement, impact calculations, denial ordering, contextual tuple logic, state machines, audit canonicalization, and migration monotonicity.
- Architecture coverage tests inventory authenticated Tenant entry points and compare them with the executable operation map. Unmapped authority decisions fail CI.
- Real MySQL tests validate Tenant-qualified constraints, transactions, locks, query-level contextual filtering, optimistic versions, roster coverage, account collision behavior, atomic batches, audit sequencing, idempotency, outbox behavior, migration convergence, and execution-time worker rechecks.
- MySQL security tests are mandatory release gates and must not be treated as passing when skipped because the database environment is absent.
- HTTP and action tests assert login/`401`, safe `403`, concealed `404`, response body, headers, download naming, cache policy, and absence of internal reason disclosure.
- Tenant-isolation fixtures use at least two Tenants with intentionally similar records plus Provider Admin, Applicant, School Admin, zero-role, inactive, pending, linked, and unlinked users.
- Differential non-enumeration tests compare foreign targets with randomized nonexistent targets across detail, list, search, autocomplete, export, preview, mutation, account collision, invitation, recovery, and School Admin nomination surfaces.
- Contextual tests cover current, planned, expired, archived, ambiguous, cross-Tenant, and transaction-time-lost relationships; complete tuples must not form Cartesian combinations.
- Projection tests independently cover ordinary view, contact data, sensitive data, documents, and exports.
- Concurrency tests use deterministic barriers and real database races for role edits, assignment changes, archival, account deactivation, last-School-Admin protection, replacement cutover, idempotent retries, audit head allocation, and rollout epoch changes.
- Worker tests revoke permission, account, relationship, entitlement, Tenant writes, or rollout epoch after enqueue and verify no unauthorized mutation commits.
- Migration tests cover resumable idempotent backfill, exact frozen legacy equivalence, zero widening, dual-write convergence, HTTP/worker canaries, rollback eligibility, and deny-only emergency mode.
- Component and browser tests cover loading, error, empty, stale, conflict, one-time secret, destructive confirmation, responsive reflow, keyboard navigation, screen-reader semantics, 200% zoom, reduced motion, and focus restoration.
- End-to-end tests cover creating and activating roles, dependency handling, multi-role assignment, final-role removal, account invitation and activation, deactivation/reactivation, Provider School Admin add/replace/recovery, contextual concealment, queued-work revocation, audit failure rollback, migration canary, and emergency mode.
- Existing repository conventions are retained: fast TypeScript tests use the current Node test runner pattern, persistence tests follow the existing MySQL test convention, and browser flows use the existing Playwright setup.
- Release validation includes unit/service/MySQL tests, browser tests, type checking, linting, production build, registry/map coverage generation, migration verification, audit-chain verification, and forbidden legacy-authority scans.

## Out of Scope

- Provider-side custom roles or Provider permission editing.
- Provider Admin implicitly acting as a Tenant principal.
- A Provider-controlled feature gate for Tenant RBAC.
- Tenant users creating permission types or entering permission keys as free text.
- Assignable wildcard permissions.
- Generic deny rules, scheduled assignments, assignment expiry workers, or a generic mutual-exclusion engine.
- Deriving authority from role names, navigation, client state, Warga Sekolah profiles, job titles, or Template Role Tenant provenance.
- Replacing domain relationships such as Wali Kelas, teaching assignment, Rombongan Belajar membership, or unit assignment with Role Tenant.
- Delegated teacher class-and-subject access before a canonical teaching-assignment tuple exists.
- Delegated unit scope based on free-text unit fields.
- Permission-bearing JWTs or cross-request authorization caches in the initial implementation.
- Tenant-facing hard deletion of roles or security audit history.
- Big-bang migration, authorization through `legacy OR RBAC`, or collapsing multi-role state back into a singular legacy role.
- Physical retention deletion beyond the defined audit retention and legal-hold policy.
- Public PPDB, Applicant, Provider, and user-owned authentication ceremonies except where regression tests must prove they remain separate.

## Further Notes

- This specification is the synthesis point for the resolved Tenant RBAC decision map. The linked decision issues remain the detailed source for permission mapping, lifecycle event taxonomy, UI states, migration invariants, and acceptance matrices.
- Implementation must be divided into blocker-aware tracer-bullet tickets. The recommended order is executable registry/operation contract, additive persistence, audit/idempotency foundation, evaluator shadow mode, Provider-owned School Admin compatibility, backfill/verifier, contextual policies, vertical conversion of existing operations, role/assignment services, non-admin account lifecycle, Tenant UI, Provider UI, canary rollout, then legacy cleanup.
- Every slice must be independently deployable in a fail-closed state and must carry its tests, telemetry, migration behavior, and rollback classification.
- Operational readiness includes dashboards and tested runbooks for denied access, suspected cross-Tenant disclosure, missing School Admin coverage, migration mismatches, stale workers, audit failure, credential delivery incidents, and emergency-mode entry or exit.
- The feature is ready for broad release only when generated permission coverage is exhaustive, Tenant isolation tests pass for every mapped surface, no mandatory database test is skipped, next-request revocation and worker rechecks are proven, audit integrity is operational, migration equivalence has zero unexplained widening, and emergency narrowing has been rehearsed.
