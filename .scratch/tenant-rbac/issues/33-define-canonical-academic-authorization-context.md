# 33 — Define canonical academic authorization context

**What to decide:** Define the canonical server-side context used to authorize Tahun Ajaran, Mata Pelajaran, Rombongan Belajar, Keanggotaan, and Wali Kelas operations.

**Blocked by:** 18 — Introduce the centralized evaluator in shadow mode; 20 — Backfill legacy non-admin access without widening; 22 — Deliver multi-role assignment and effective access.

**Status:** resolved

## Question

What authoritative context must the centralized evaluator receive and revalidate for an academic operation?

The decision must define:

- Tenant and authenticated user identity;
- effective Tenant permissions and supplemental permissions;
- Tahun Ajaran and Rombongan Belajar scope;
- effective-at date semantics;
- currently effective eligible relationships, including Wali Kelas;
- lifecycle, entitlement, read-only, and optimistic-version gates;
- concealed behavior for foreign, nonexistent, and out-of-scope records;
- the server-only interface used by pages, actions, handlers, and transactions.

The result must distinguish RBAC permission from contextual record scope and must fail closed when context is missing or stale.

## Answer

### Decision

Use one server-constructed `AcademicAuthorizationContext` as the authoritative input to every protected Tahun Ajaran, Mata Pelajaran, Rombongan Belajar, Keanggotaan Rombongan Belajar, and Wali Kelas query or mutation. Pages, server actions, route handlers, services, and workers may supply only the requested operation, opaque resource references, an optional policy-approved historical date, requested projections, and mutation concurrency tokens. They must not supply an authoritative `userId`, `tenantId`, permission set, role, profile, relationship, lifecycle state, entitlement state, or precomputed scope.

The centralized evaluator resolves and validates those facts from current persistence. Domain wrappers may narrow the interface with typed operation names, but must delegate to the same evaluator and policy registry.

Authorization remains the conjunction:

```text
allow = authenticated same-Tenant principal
     AND Tenant operational gate
     AND feature entitlement gate
     AND exact base Permission Tenant
     AND every requested supplemental Permission Tenant
     AND operation-owned academic scope policy
     AND lifecycle/domain invariants
     AND, for mutations, transactional freshness and version gates
```

RBAC answers **which operation the Akun Pengguna may attempt**. Academic context answers **which records are in scope at the operation's effective date**. Neither implies the other. School Admin system policy may bypass an operation's narrower Assigned arm, but never Tenant isolation, projection permissions, entitlement/read-only gates, lifecycle rules, versions, or audit requirements.

### Canonical context

The evaluator constructs an immutable context with these logical sections:

```ts
interface AcademicAuthorizationContext {
  principal: {
    userId: UserId
    tenantId: TenantId
    authority: "school-admin" | "tenant-rbac"
    effectivePermissions: ReadonlySet<PermissionKey>
    sourceRoleIds: readonly RoleTenantId[] // audit/explanation only
    linkedPersonId: SchoolPersonId | null
    eligibleProfileIds: {
      teacherId?: TeacherProfileId
      studentId?: StudentProfileId
    }
  }
  request: {
    operation: AcademicOperation
    access: "read" | "write"
    effectiveAt: LocalDate
    effectiveAtMode: "current" | "authorized-historical"
    requiredPermission: PermissionKey
    requiredSupplementalPermissions: ReadonlySet<PermissionKey>
    policy: AcademicScopePolicy
  }
  tenant: {
    operationalStatus: TenantOperationalStatus
    readOnly: boolean
    entitlements: ReadonlySet<FeatureEntitlement>
  }
  scope: {
    academicYear?: AuthorizedAcademicYear
    classGroup?: AuthorizedClassGroup
    subject?: AuthorizedSubject
    relationshipProofs: readonly AcademicRelationshipProof[]
  }
}
```

This is a logical contract, not a client DTO and not permission-bearing state that may be serialized into a cookie, JWT, hidden field, URL, or browser cache. IDs used in `sourceRoleIds` are explanatory only. Role names, profile labels, and legacy session role fields have no authority.

The persisted principal resolution must prove:

- the session's `userId` identifies one active, activated Tenant account;
- the account belongs to exactly the Tenant resolved from the server-owned domain/request boundary;
- Provider Admin, Applicant, foreign-Tenant, inactive, malformed, or ambiguously linked identities are not Tenant principals;
- School Admin authority comes only from current Provider-owned authority; otherwise effective permissions are the deduplicated additive union of current active Role Tenant assignments and valid active-role permission entries;
- suspended assignments, draft/archived roles, unknown registry keys, invalid registry versions, and stale session claims grant nothing; and
- the optional Akun Pengguna → Warga Sekolah → Profil Guru/Siswa path is current, same-Tenant, unambiguous, active, and unarchived before it can participate in Self or Assigned scope. Merely having a profile grants nothing.

`requiredPermission` is the exact operation key from the code-owned registry, including the approved academic keys under `academic-years.*`, `subjects.*`, and `class-groups.*`. Supplemental keys are independent projection gates, not alternate base permissions. A read may return the minimum authorized projection when an optional supplemental key is absent; if the caller explicitly requests a protected projection, every key declared for that projection is required. Reference selectors exposed by PPDB, quiz, or another feature use that feature's least-data permission and do not confer access to the full academic administration workspace.

### Academic scope policies

Every `AcademicOperation` maps in code to exactly one typed policy. Callers cannot choose a broader policy arm.

- **Tenant-wide academic administration:** the existing Tahun Ajaran and Mata Pelajaran operations, Rombongan Belajar administration, Keanggotaan assignment/transfer, and Wali Kelas assignment use their operation's fixed same-Tenant scope after the exact permission passes. This is not a generic scope bit transferable to other operations.
- **Assigned Rombongan Belajar:** where a later operation explicitly admits delegation, scope requires one complete current Wali Kelas or other canonical assignment proof from the principal's linked eligible profile to the exact Rombongan Belajar. A Wali Kelas proof applies only to policy arms explicitly declared for homeroom responsibilities.
- **Assigned class and subject:** scope requires one canonical tuple connecting the same principal profile, Tahun Ajaran/Semester, Rombongan Belajar, and Mata Pelajaran. Independent class and subject facts cannot be combined. Because no canonical teaching-assignment tuple currently exists, this arm fails closed until that relation exists.
- **Self:** only an operation explicitly declaring Self may use the same-Tenant Akun Pengguna → Warga Sekolah → profile linkage. Creator/audit IDs, matching email, role names, and possession of an opaque ID are not Self proofs.

For a Rombongan Belajar target, the context must prove a same-Tenant chain `Rombongan Belajar → Tahun Ajaran`. For a Keanggotaan target it must additionally prove `Keanggotaan → Rombongan Belajar → Tahun Ajaran` and an eligible same-Tenant Profil Siswa. For Wali Kelas it must prove `Wali Kelas → Rombongan Belajar → Tahun Ajaran` and an eligible same-Tenant Profil Guru. Mata Pelajaran is a Tenant catalog record and does not itself prove any class, teacher, or teaching assignment.

A relationship proof is valid only when every endpoint and join is Tenant-qualified, eligible for the operation, lifecycle-compatible, and effective at the same `effectiveAt`. Missing endpoints, mixed-Tenant joins, overlapping relationships where uniqueness is required, unsupported policy arms, or internally inconsistent state fail closed and emit an internal integrity/security signal.

### Effective-at semantics

Academic relationships use an ISO date-only `LocalDate`, not a browser timestamp. For current operational access, `effectiveAt` is derived by the server for the Tenant's current civil date and is captured once per evaluation/transaction. The browser may not select an arbitrary date to obtain authority.

The standard interval is half-open: `startedAt <= effectiveAt` and (`endedAt` is null or `effectiveAt < endedAt`). Therefore a replacement beginning on date D is effective on D and the relationship closed at D is not. Planned relationships grant no current scope even if their start date is otherwise eligible; ended, suspended, archived, cancelled, replaced, or ineligible relationships grant none.

A non-current date is accepted only for an operation whose policy explicitly supports historical access. The evaluator validates the date against the requested Tahun Ajaran/semester and the operation's bounded historical range. Historical relationship state authorizes only that historical operation and projection; it never restores current operational scope. A missing, malformed, ambiguous, unauthorized, or out-of-range effective date fails closed.

Tahun Ajaran lifecycle is explicit and forward-only: calendar dates do not activate, advance, close, archive, or restore it. The effective date selects relationship state; it does not override aggregate lifecycle.

### Lifecycle, entitlement, read-only, and version gates

The operation registry declares the required aggregate states and reference eligibility. At minimum:

- archived or lifecycle-incompatible Tahun Ajaran, Mata Pelajaran, and Rombongan Belajar cannot be mutation targets except for the exact archive/restore/lifecycle operation that admits their present state;
- Rombongan Belajar references the same Tenant's eligible Tahun Ajaran; immutable academic dimensions remain frozen after activation;
- Keanggotaan requires an eligible Profil Siswa and Rombongan Belajar/Tahun Ajaran, preserves the no-overlap invariant, and transfer atomically closes the old interval and opens the new one;
- Wali Kelas requires an eligible Profil Guru and Rombongan Belajar/Tahun Ajaran, preserves the declared one-effective-assignment constraints, and replacement atomically closes the old interval and opens the new one;
- archive and restore continue to enforce relationship blockers and reference eligibility; and
- reads may include historical/archived data only when the operation and projection explicitly admit it.

The evaluator independently requires the relevant current entitlement (including the approved Master Data entitlement for these administration operations). A read-only Tenant may perform admitted reads but no write, including lifecycle, assignment, transfer, archive, or restore. Entitlement or read-only failure is `403`; neither is disguised as record scope.

Every mutable aggregate and versioned relationship operation carries an `expectedVersion` or equivalent concurrency token. The token is untrusted input used only for comparison. It never supplies current state. Operations that atomically replace relationships must lock or compare every affected current relationship even where the current schema uses an equivalent uniqueness/locking predicate rather than a numeric version.

### Server-only interface

Expose one low-level server-only facade and typed academic wrappers conceptually equivalent to:

```ts
type AcademicAuthorizationRequest = Readonly<{
  operation: AcademicOperation
  resource?: AcademicResourceRef
  requestedProjections?: readonly AcademicProjection[]
  historicalEffectiveAt?: LocalDate
  expectedVersions?: Readonly<Record<string, number>>
}>

async function requireAcademicAccess(
  request: AcademicAuthorizationRequest,
): Promise<AcademicAuthorizationContext>

async function withAuthorizedAcademicMutation<T>(
  request: AcademicMutationAuthorizationRequest,
  mutate: (tx: AcademicTransaction, context: AcademicAuthorizationContext) => Promise<T>,
): Promise<T>
```

`requireAcademicAccess` obtains authentication and the Tenant from server-owned request/domain resolution; those values are deliberately absent from its public request. It returns an opaque, immutable server capability usable only by repository/service functions that require authorized context. Raw principal-shaped objects such as the current `MasterDataPrincipal` must not remain forgeable authorization inputs at pages/actions.

`withAuthorizedAcademicMutation` opens the transaction, reloads and revalidates the complete context inside it, executes only Tenant-qualified and version-qualified writes, appends the audit event in the same transaction, and commits atomically. A preflight context may improve error messages but is never sufficient to write.

Workers use the same operation registry and evaluator with an explicit server-authenticated actor/job identity policy; a queued snapshot of permissions or relationships is not authority. At execution they re-resolve Tenant state, entitlement, actor/system authority, scope, lifecycle, and versions.

### Query and concealment contract

Direct lookups begin with the verified `tenantId` and apply the complete scope predicate before materializing the record. Foreign IDs, nonexistent IDs, malformed opaque IDs, same-Tenant records outside the declared contextual scope, and relationship paths that no longer establish scope all have the same external not-found behavior (`404` for HTTP surfaces). Internal structured reasons may distinguish `record-not-found`, `tenant-mismatch`, `scope-denied`, and `relationship-stale`, but must not reveal that distinction to the caller.

Collections embed the identical Tenant, lifecycle, effective-date, and relationship predicate in the authoritative query before search, sorting, counts, facets, pagination, autocomplete, summaries, or export. An authorized empty set returns empty data. Missing the base permission or a required projection permission returns `403`; rows are never fetched Tenant-wide and filtered afterward.

For mutations, concealment is evaluated before conflict disclosure. If the target is foreign, absent, or now out of scope, return the concealed not-found result even when the submitted version is stale. Return the domain conflict result only after the caller's current same-Tenant permission and scope are re-proven, and never include inaccessible current state in that response. Bulk operations are all-or-nothing and do not identify which supplied opaque ID was foreign or out of scope.

### Freshness and fail-closed boundary

Request-local memoization is allowed only for facts read at one declared consistency point. No authorization fact may survive into another request. Revoked permissions, ended Wali Kelas assignments, transferred students, changed lifecycle, disabled entitlement, and read-only transitions are observed on the next request.

Inside every mutation transaction, reload and revalidate:

1. session actor, active account, exact Tenant membership, and School Admin or active multi-role authority;
2. registry-valid base and supplemental permissions;
3. Tenant operational/read-only state and relevant entitlement;
4. target records through Tenant-qualified keys;
5. the complete effective-dated academic relationship proof and all endpoint eligibility/lifecycle state;
6. operation-specific domain invariants, blockers, and every bulk target;
7. every expected target/relationship version or equivalent locked concurrency predicate; and
8. the audit actor and event payload before atomic commit.

Any missing field, unsupported operation-policy mapping, unavailable authoritative store, stale registry/rollout version, inconsistent relationship, failed lock/version predicate, or changed permission/scope denies the operation. The evaluator never fills a security-critical gap from client data, role/profile names, unrelated relationships, or a permissive default.
