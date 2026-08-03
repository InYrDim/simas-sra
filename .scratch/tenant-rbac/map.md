# Tenant RBAC Wayfinding Map

## Destination

A decision-complete specification for universal Tenant RBAC, ready for implementation across the data model, server enforcement, contextual data boundaries, Tenant role-management UI, Provider School Admin lifecycle UI, auditability, migration, and validation.

## Notes

- Domain: authorization for authenticated Tenant users; use `grilling`, `domain-modeling`, and `code-security` while resolving policy and architecture decisions.
- This map plans the work; implementation is out of scope until the specification is decision-complete.
- Provider authorization remains a separate security context. Provider Admin exclusively manages every School Admin lifecycle.
- Tenant RBAC is universal for every active Tenant and does not use a Provider-controlled feature gate.
- Role grants are additive: one Akun Pengguna may hold multiple Role Tenant entries, and there is no deny rule.
- Profiles such as Profil Guru and Profil Staf describe a person; Role Tenant describes application authority.
- School Admin may compose custom roles only from a system-owned permission catalog.
- RBAC grants capabilities; contextual domain rules still constrain which records are in scope.
- Server authorization is authoritative, fails closed, and observes changed grants on the next request.
- UI hides unauthorized features; direct navigation and server operations return a consistent access-denied result.

## Decisions so far

- [Fix the Tenant RBAC destination and security invariants](./issues/01-fix-destination-and-security-invariants.md) — Tenant-only universal multi-role RBAC, with Provider-owned School Admin lifecycle and server-authoritative immediate enforcement.
- [Inventory current authorization surfaces](./issues/02-inventory-current-authorization-surfaces.md) — Current guards preserve Tenant boundaries but collapse authority into singular School Admin checks, broad operations, and mixed entitlement/permission policies.
- [Define the permission language and catalog](./issues/03-define-permission-language-and-catalog.md) — Stable code-owned `<module>.<resource>.<action>` keys use explicit actions, dependencies, risk and assignability metadata, fail-closed evolution, and Indonesian UI metadata.
- [Define system and custom role lifecycle](./issues/04-define-system-and-custom-role-lifecycle.md) — Provider-owned School Admin, versioned templates, and Tenant roles follow fail-closed draft/active/archive transitions with stable identity, explicit impact, concurrency control, and no Tenant hard delete.
- [Define user assignment workflows](./issues/05-define-user-assignment-workflows.md) — Tenant-scoped atomic multi-role assignment explains effective access, supports audited bulk changes and zero-role accounts, and suspends rather than silently restores inactive-account grants.
- [Design the server authorization interface](./issues/06-design-server-authorization-interface.md) — A centralized server-only evaluator reloads authoritative grants per request, composes Tenant, entitlement, permission, and contextual gates, and atomically revalidates sensitive mutations.
- [Define contextual data boundaries](./issues/07-define-contextual-data-boundaries.md) — Permissions authorize operations while code-owned Assigned, Unit, Self, or intrinsically Tenant-wide policies constrain records; only School Admin may bypass a narrower contextual policy.
- [Prototype the Tenant role-management UI](./issues/08-prototype-tenant-role-management-ui.md) — A responsive Akses & Peran workspace separates role composition from account assignment and makes dependencies, effective access, impact, audit, loading, and accessibility states explicit.
- [Prototype the Provider School Admin UI](./issues/09-prototype-provider-school-admin-ui.md) — A Provider-only roster uses separate authority and proof states, permits one or more active School Admins, and performs replacement as an atomic audited cutover.
- [Define the audit and recovery policy](./issues/10-define-audit-and-recovery-policy.md) — Canonical lifecycle events, transactional append-only audit, deterministic hash-chain ordering, scoped visibility, retention, and forward-only recovery make security changes explainable and recoverable.
- [Design the legacy role migration](./issues/11-design-legacy-role-migration.md) — An expand, dual-write, backfill, shadow, intersection-canary, RBAC-cutover, and contract sequence preserves legacy access without widening and retains a deny-only RBAC emergency mode.
- [Fix validation and specification handoff](./issues/12-fix-validation-and-spec-handoff.md) — Layered security, isolation, permission-matrix, UI, concurrency, audit, migration, worker, observability, and runbook gates define fourteen incremental implementation slices.
- [Map current operations to permissions](./issues/13-map-current-operations-to-permissions.md) — Current and target operations map to 149 canonical keys, with exact contextual/projection requirements and a zero-widening legacy-role equivalence contract.
- [Define the non-admin Tenant account lifecycle](./issues/14-define-non-admin-account-lifecycle.md) — School Admin-only account creation, invitation, profile linking, credential administration, deactivation, reactivation, and role handoff remain separate from Provider-owned School Admin authority.
- [Define canonical academic authorization context](./issues/33-define-canonical-academic-authorization-context.md) — A server-constructed, effective-dated academic context composes current RBAC and supplemental permissions with Tenant-qualified record scope, lifecycle, entitlement, concealment, and transactional freshness gates.
- [Introduce canonical teaching assignment](./issues/34-introduce-canonical-teaching-assignment.md) — A versioned, audited Penugasan Mengajar tuple binds one eligible Guru, Mata Pelajaran, Rombongan Belajar, and Tahun Ajaran through an explicit effective lifecycle without deriving authority from Wali Kelas.
- [Define academic preview-commit security protocol](./issues/35-define-academic-preview-commit-security-protocol.md) — Short-lived opaque previews bind confirmed intent but carry no authority; commit reauthorizes and validates every target before one idempotent atomic mutation or sensitive export.

## Not yet specified

- None. The specification destination is decision-complete; implementation must follow the gated slices and acceptance requirements in issue 12.

## Out of scope

- Provider-side custom roles or permission editing.
- User-defined permission types or permission code entered as free text.
- Deriving authorization by parsing role names such as `Staf Perpustakaan`.
- Replacing domain assignments such as teaching, class, or unit relationships with RBAC.
- Automatically granting Role Tenant solely because a person has a Profil Guru, Profil Staf, or other domain profile.
