# 35 — Define academic preview-commit security protocol

**What to decide:** Define the transaction protocol for sensitive academic previews and commits.

**Blocked by:** 33 — Define canonical academic authorization context; 34 — Introduce canonical teaching assignment.

**Status:** resolved

## Question

How must preview state be represented and revalidated so context loss cannot produce a partial academic mutation?

The decision must define:

- preview snapshot or token contents;
- expiry and replay behavior;
- exact permission and contextual reauthorization at commit;
- lifecycle, entitlement, relationship, and optimistic-version rechecks;
- all-target validation before the first mutation;
- complete rollback when any concealed target is invalid or out of scope;
- one non-disclosing external failure contract;
- audit and race-condition behavior.

The protocol must apply to membership bulk operations, transfer, Wali Kelas assignment/replacement, export/print, and any future teaching delegation workflow.

## Answer

### Decision

Sensitive academic workflows use a two-phase **explain, then reauthorize-and-commit** protocol:

1. **Preview** resolves the current server-owned academic context, validates the complete proposed intent, and persists a short-lived explanatory snapshot behind an opaque random token.
2. **Commit** treats that snapshot as untrusted historical evidence of what the user confirmed. Inside one transaction or consistent read boundary, it re-resolves the actor and Tenant, reloads every target and relationship, reruns the exact operation policy and all invariants, verifies optimistic versions, validates the entire target set before the first domain write or byte of sensitive output, and then atomically consumes the preview with the mutation and audit.

A preview is never a permission, capability, lock, reservation, promise of success, or substitute for current persistence. No signed/browser-held snapshot, JWT claim, hidden field, page state, prior query result, queued payload, or cross-request cache may authorize commit.

The protocol is mandatory for:

- bounded bulk Keanggotaan Rombongan Belajar assignment;
- transfer that closes one membership and opens another;
- Wali Kelas assignment or replacement;
- sensitive or bulk academic export/print generation;
- Penugasan Mengajar planning, activation, end, cancellation, replacement, or bulk workflow; and
- any future academic operation whose registry metadata marks it `previewRequired` because it changes relationships, authority-bearing context, many records, or releases sensitive bulk data.

Ordinary single-record mutations may use the same transaction reauthorization without a separate user-visible preview when the operation registry does not require one. They do not receive weaker commit rules.

### Server-stored preview record

The server persists an `AcademicOperationPreview` in Tenant-owned storage. The browser receives only a cryptographically random, unguessable opaque token with at least 128 bits of entropy. Store only a keyed digest of the raw token; never log, audit, place in a URL, or persist the bearer token itself. The token is submitted in the protected request body under normal session and CSRF/origin protections.

```ts
type AcademicPreviewState =
  | "pending"
  | "committed"
  | "invalidated"
  | "expired"
  | "cancelled"

type AcademicOperationPreview = Readonly<{
  id: AcademicPreviewId
  tokenDigest: SecretDigest
  tenantId: TenantId
  actorUserId: UserId
  operation: AcademicOperation
  intentDigest: Digest
  normalizedIntent: EncryptedOrProtectedIntent
  targetSnapshot: readonly AcademicPreviewTarget[]
  requiredPermission: PermissionKey
  requiredSupplementalPermissions: readonly PermissionKey[]
  policyKey: AcademicPolicyKey
  policyVersion: number
  registryVersion: number
  rolloutEpoch: number
  effectiveAt: LocalDate
  effectiveAtMode: "current" | "authorized-historical"
  explanation: AcademicPreviewExplanation
  state: AcademicPreviewState
  expiresAt: Instant
  version: number
  createdAt: Instant
  committedAt: Instant | null
  invalidatedAt: Instant | null
  commitIdempotencyKey: string | null
  outcomeDigest: Digest | null
}>

type AcademicPreviewTarget = Readonly<{
  kind: AcademicResourceKind
  id: OpaqueResourceId
  observedVersion: number | null
  relationshipVersions: readonly Readonly<{
    kind: AcademicRelationshipKind
    id: OpaqueRelationshipId
    observedVersion: number | null
  }>[]
}>
```

The stored `normalizedIntent` contains only the canonical command the user is confirming: operation, sorted/deduplicated target IDs, destination/reference IDs, effective date, requested projection/export format, and normalized reason where applicable. `intentDigest` is computed over a deterministic serialization that includes operation and Tenant binding. Commit resubmission must produce the same normalized digest; a different payload cannot reuse the preview.

The target snapshot records identifiers and observed versions needed to explain change and detect staleness. It may also store safe before/after summaries, counts, warnings, and a digest of the rendered result. It must not store reusable authority, raw permissions as claims, session secrets, protected file paths, or denormalized relationship facts that commit can trust. Sensitive preview details remain server-side, encrypted or otherwise protected according to the data classification, Tenant-qualified, access-controlled, excluded from routine logs, and removed according to short preview retention.

`requiredPermission`, supplemental permissions, policy/version, registry version, and rollout epoch freeze **what the user reviewed**, not what the server will authorize. Commit requires the current code-owned operation mapping to be supported and compatible. If the mapping, registry, or rollout epoch changed, the preview is invalidated and must be regenerated; commit must not silently apply a newly broader or materially different policy.

### Preview creation

Preview creation itself is a protected read and uses `requireAcademicAccess` with the same base permission, supplemental projection permissions, Tenant entitlement, read-only semantics, contextual policy, effective date, and target scoping that commit will use. The server derives actor and Tenant; neither is accepted from the browser.

Preview processing must:

1. parse, normalize, deduplicate, and size-bound the complete intent;
2. resolve every opaque target through Tenant-qualified queries and the operation's full contextual predicate;
3. load all aggregate and relationship versions, endpoint eligibility, academic lifecycle, blockers, overlap sets, and effective-dated relationships needed by the operation;
4. validate the complete batch and calculate the exact proposed effects without writing domain state;
5. present only authorized projections and aggregate counts; and
6. persist the pending preview and its explanation before returning the opaque token.

A preview is created only when the entire proposed operation is currently valid. There is no partially valid commit token. The UI may show unchanged items separately for explanation, but they remain part of the normalized target set and are revalidated at commit so they cannot conceal a changed outcome.

For collections and bulk selection, preview scope is applied in the authoritative query before totals, sorting, pagination, or export. Client-supplied "select all" filters are normalized into an explicit bounded target set at preview time; commit never reruns an unbounded browser filter as authority. Academic batch limits are declared per operation and enforced at both phases.

### Expiry, cancellation, and replay

A mutation preview expires ten minutes after creation. The operation registry may choose a shorter duration for especially sensitive data, but never a longer one without a new security decision. Export/print previews expire after five minutes because they release a point-in-time bulk projection. Expiry is checked against server time at commit; a background cleanup may mark or delete old rows but is not the security boundary.

A preview is bound to exactly one Tenant, actor, operation, normalized intent, policy/version set, and authenticated session context. Logging out, account deactivation, Tenant/context change, explicit cancellation, or successful commit makes it unusable. A new preview supersedes no other preview automatically; each token remains independently bounded and single-use until expired/cancelled, but concurrency/version checks ensure at most one compatible mutation succeeds.

Commit supplies a client-stable `idempotencyKey` generated before the first submission. The server atomically binds the first key to the preview:

- retrying the same consumed preview with the same key and same intent returns the already-recorded safe outcome without executing again;
- the same token with a different key or different intent is rejected;
- the same idempotency key with a different preview/intent is rejected; and
- a pending preview may have only one in-flight commit because its row is locked and version-checked.

A failed authoritative revalidation caused by expiry, replay, stale data, scope loss, changed policy, changed permission, changed entitlement, or failed domain invariant terminally marks the preview `invalidated` in a no-domain-write transaction. The user must create a fresh preview. A transport interruption before the server begins processing leaves it pending; an indeterminate response after processing is resolved by retrying the same idempotency key, never by issuing a second command blindly. Infrastructure failure that cannot durably record an outcome returns unavailable and grants nothing.

Raw token comparison is constant-time after digest lookup where applicable. Tokens and idempotency keys are credentials/control material: redact them from logs, traces, analytics, error reporting, and audit payloads.

### Commit protocol

`withAuthorizedAcademicMutation` implements this order inside one database transaction at an isolation/locking strategy sufficient for the aggregate's races:

1. derive the current authenticated `userId` and Tenant from server-owned request/domain resolution;
2. find and lock the pending preview by Tenant and token digest; validate actor, operation, intent digest, state, expiry, preview version, and idempotency binding;
3. verify the current operation registry, policy version, and rollout epoch are supported and materially identical to what was confirmed;
4. reload the persisted account, exact Tenant membership, activation state, School Admin authority or current active multi-role assignments, valid role permissions, and linked Warga Sekolah/profile path;
5. require the exact current base Permission Tenant and every supplemental permission required by the operation/projection;
6. reload Tenant operational/read-only state and every relevant feature entitlement;
7. reload every target by verified Tenant and ID, plus Tahun Ajaran, Semester where declared, Mata Pelajaran, Rombongan Belajar, Profil Guru/Siswa, Keanggotaan, Wali Kelas, and Penugasan Mengajar endpoints required by the operation;
8. evaluate every relationship at one transaction-captured server `effectiveAt`, including complete teaching tuples rather than independent class/subject facts;
9. recheck lifecycle, archive state, endpoint eligibility, blockers, capacity/uniqueness/overlap rules, immutable fields, and all other domain invariants;
10. compare every aggregate and relationship version from the preview/command and establish write locks or equivalent concurrency predicates for rows whose absence/open slot is itself an invariant;
11. compute the authoritative after-state and audit intent for the complete target set in memory without writing domain rows;
12. only after all targets pass, execute Tenant-qualified and version-qualified writes, append all audit/history events, mark the preview `committed`, and persist the idempotent outcome; and
13. commit once. Any failure rolls back every domain write, audit event, generated artifact reference, outbox message, and preview success transition.

There is no loop that validates and commits one target at a time. Chunking may be used only for bounded reads/calculation before writes; it must not create partial success. Database constraints are defense in depth and any late constraint failure rolls back the whole operation.

The command's expected versions are untrusted comparison inputs. Current rows are always reloaded. Missing numeric versions for append-only relationships must be replaced by explicit locked predicates covering the relevant open/effective rows and uniqueness slots; absence is not assumed stable merely because preview observed none.

### Operation-specific atomic sets

- **Bulk membership assignment:** lock/validate the destination Rombongan Belajar/Tahun Ajaran and every selected Profil Siswa plus every effective/planned membership slot. If any target is foreign, missing, ineligible, occupied, stale, or now out of scope, create no memberships and emit no membership events.
- **Transfer:** treat the source membership, destination Rombongan Belajar, student, year, close operation, replacement membership, and both history events as one atomic set. The source remains open if the destination cannot be created.
- **Wali Kelas assignment/replacement:** validate teacher, group, year, current homeroom, teacher-year slot, effective date, and replacement. Closing the incumbent and opening the successor plus linked events commit together or not at all.
- **Penugasan Mengajar:** validate the complete Tenant/teacher/subject/class/year tuple, effective interval, status transition, endpoint eligibility, and all exact-tuple overlap rows under lock. End-and-replace and their events are one atomic set. Wali Kelas never substitutes for the tuple.
- **Export/print:** treat generation as a sensitive read commit. Reauthorize actor, permission, supplemental projections, entitlement, scope, effective date, and every selected row at one consistent snapshot before emitting headers, bytes, counts, or a job. The generated set may differ from preview only by invalidating the preview; it must not silently export a newly changed set.

For a queued export, commit atomically consumes the preview and creates a Tenant-bound job containing normalized intent and expected snapshot digest, not reusable user authority. The worker uses the approved server-authenticated job policy and reruns current entitlement, operation policy, scope, and data-version checks immediately before generation. If human authority is required by that policy and can no longer be proven, the job fails closed. Artifacts use protected Tenant-qualified storage, short-lived authorized download, private/no-store responses, and deletion/retention rules; no browser-supplied path is trusted.

### Non-disclosing external failure contract

After an authenticated caller submits a syntactically valid preview commit, every failure caused by an unknown/foreign token, wrong actor or Tenant, expiry, cancellation, replay mismatch, intent mismatch, policy/rollout change, lost permission, lost contextual relationship, concealed foreign/missing target, lifecycle change, stale version, overlap, blocker, or other authoritative revalidation failure returns one safe result:

```ts
{
  ok: false,
  code: "academic-preview-no-longer-valid",
  message: "Pratinjau tidak lagi berlaku. Muat ulang data dan tinjau kembali sebelum melanjutkan."
}
```

HTTP surfaces use `409 Conflict` for this post-preview result. The response contains no target ID, index, count of invalid targets, current version, current owner/class, role/permission detail, Tenant identity, or indication whether the token or record ever existed. This protocol-specific result does not replace the ordinary login/`401` behavior before a commit is accepted, nor does it expose why a fresh preview request receives the normal safe `403` or concealed `404` contract.

Validation errors that are purely local to a new, uncommitted form may be field-specific before preview creation. Once a preview token exists, any authoritative divergence uses the single result above. Internal structured reasons and affected IDs are restricted to security telemetry/audit channels with Tenant-safe access controls.

### Audit and observability

Preview reads do not create domain history. Record a minimal security event for creation, cancellation, invalidation, and commit using preview ID (not raw token), Tenant, actor, operation, target count or safe aggregate, policy/registry versions, idempotency correlation, timestamps, and a reason code. Do not copy sensitive row data or concealed foreign IDs into general logs.

A successful mutation writes:

- one batch/command audit envelope with correlation and preview IDs, normalized operation, effective date, reason, and safe before/after digests;
- deterministic child domain events for every changed aggregate/relationship, ordered by stable Tenant-qualified identity;
- explicit source/replacement linkage for transfer, Wali Kelas replacement, or Penugasan Mengajar replacement; and
- the committed preview/idempotent outcome.

All success records commit in the same transaction as domain state. An invalidated preview writes only the restricted preview/security outcome and no domain audit suggesting a change occurred. Audit actor is re-resolved at commit; a browser-provided actor is never accepted.

Metrics distinguish preview creation, expiry, invalidation reason class, conflict/replay, successful commit, rollback, and worker/export failure without high-cardinality personal or resource identifiers. Repeated unknown-token or cross-context attempts trigger rate-limited security signals without changing the uniform response.

### Race and validation requirements

Implementation evidence must include real-database tests that pause competing transactions around preview, lock acquisition, validation, first write, and audit append. Required races include:

- permission/role revocation, account deactivation, Tenant read-only transition, or entitlement disable after preview;
- student transfer, Wali Kelas replacement, teaching-assignment end, profile unlink/archive, subject/archive, class/year lifecycle transition, and blocker creation after preview;
- two commits of one token, same idempotency key with different payload, different keys for one preview, and two previews racing for the same effective slot;
- one target in a bounded batch becoming foreign, missing, stale, ineligible, or out of scope;
- exact-tuple teaching overlap inserted concurrently;
- export rows/projections changing between preview and generation; and
- failure after one attempted write or audit append proving complete rollback and safe idempotent retry.

Tests must assert zero partial domain rows, zero orphan history/audit/outbox records, no generated artifact on failure, uniform external errors, no concealed identifiers in logs/responses, and exactly one effect for a successful retried idempotent commit.
