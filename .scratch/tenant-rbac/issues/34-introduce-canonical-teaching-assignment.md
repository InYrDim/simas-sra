# 34 — Introduce canonical teaching assignment

**What to decide:** Define the canonical teaching-assignment tuple required before any teaching-subject authority or delegation can be granted.

**Blocked by:** 33 — Define canonical academic authorization context.

**Status:** resolved

## Question

What data and lifecycle rules make a teaching assignment complete, tenant-owned, effective, and eligible for authorization?

The decision must define the canonical tuple, including at minimum:

- Tenant;
- teacher;
- subject;
- Rombongan Belajar;
- Tahun Ajaran;
- effective start and end;
- lifecycle/status;
- audit actor and optimistic version where applicable.

It must define behavior for missing, foreign-Tenant, archived, expired, overlapping, and future-effective assignments. Until this decision is implemented, unsupported teaching delegation remains denied and Wali Kelas status must never imply subject-teaching authority.

## Answer

### Decision

Introduce **Penugasan Mengajar** as the sole canonical relationship proving that one eligible Profil Guru teaches one exact Mata Pelajaran to one exact Rombongan Belajar in one Tahun Ajaran for a bounded effective period. It is Tenant-owned domain data, not RBAC data, a role assignment, Wali Kelas metadata, a timetable entry, or a teaching-load calculation.

For Assigned class-and-subject authorization, the evaluator must resolve one persisted Penugasan Mengajar row whose complete tuple matches the principal's linked Profil Guru and the operation's exact subject, class, year, and effective date. Independent teacher, subject, class, year, role, and Wali Kelas facts must never be combined to synthesize the tuple.

Creating this model does not itself enable delegation. Delegation remains denied until persistence, lifecycle commands, the centralized evaluator, operation-policy mappings, transaction revalidation, audit, and tests implement this decision. A valid Penugasan Mengajar supplies contextual record scope only; the Akun Pengguna must independently hold the operation's exact Permission Tenant and pass Tenant, entitlement, read-only, lifecycle, projection, and version gates.

### Canonical tuple and identity

A Penugasan Mengajar is a stable, versioned aggregate with this logical shape:

```ts
type TeachingAssignmentStatus =
  | "planned"
  | "active"
  | "ended"
  | "cancelled"

type TeachingAssignment = Readonly<{
  id: TeachingAssignmentId
  tenantId: TenantId
  teacherProfileId: TeacherProfileId
  subjectId: SubjectId
  classGroupId: ClassGroupId
  academicYearId: AcademicYearId
  startsOn: LocalDate
  endsOn: LocalDate | null
  status: TeachingAssignmentStatus
  reason: string
  version: number
  createdByUserId: UserId
  createdAt: Instant
  updatedAt: Instant
}>
```

The authorization tuple is:

```text
(tenantId,
 teacherProfileId,
 subjectId,
 classGroupId,
 academicYearId,
 effective interval,
 eligible status)
```

`id` is the relationship identity used for audit and optimistic concurrency. `academicYearId` is intentionally stored even though Rombongan Belajar already points to a Tahun Ajaran: a database constraint or transaction invariant must prove `assignment.academicYearId = classGroup.academicYearId`, preventing a join from drifting or being reconstructed from unrelated data. It is not a caller-selectable override.

All relationship endpoints use Tenant-qualified composite foreign keys:

- `(tenantId, teacherProfileId)` → Profil Guru;
- `(tenantId, subjectId)` → Mata Pelajaran;
- `(tenantId, classGroupId)` → Rombongan Belajar;
- `(tenantId, academicYearId)` → Tahun Ajaran; and
- `(tenantId, createdByUserId)` → the Tenant actor recorded at creation.

A database row must not be insertable with mixed-Tenant endpoints. Repository reads and writes always begin with the verified `tenantId`; a globally opaque ID alone is never sufficient.

The tuple deliberately excludes Semester, schedule, room, weekly hours, curriculum, grade weights, and teaching load. Those may later reference Penugasan Mengajar, but must not be guessed or overloaded into this authorization proof. If a future operation is semester-specific, it additionally proves the requested Semester belongs to the same Tahun Ajaran and that `effectiveAt` lies within it; absence of a semester column does not permit cross-semester inference.

### Endpoint eligibility

A Penugasan Mengajar may be created or activated only when all endpoints are current and compatible:

- Profil Guru belongs to the same Tenant, is active, unarchived, and remains linked through an unambiguous same-Tenant Warga Sekolah when used to authorize an Akun Pengguna;
- Mata Pelajaran belongs to the same Tenant, is unarchived, and includes the Rombongan Belajar's education level;
- Rombongan Belajar belongs to the same Tenant, is unarchived, references the exact Tahun Ajaran in the tuple, and has a lifecycle admitted by the requested transition;
- Tahun Ajaran belongs to the same Tenant, is unarchived, and its lifecycle is compatible with the assignment status; and
- `startsOn` and non-null `endsOn` lie within the Tahun Ajaran's inclusive date bounds.

The effective interval is half-open: `startsOn <= effectiveAt` and (`endsOn` is null or `effectiveAt < endsOn`). A non-null `endsOn` must be strictly later than `startsOn`; zero-length assignments are invalid. Closing on date D removes authority on D. Date values are validated ISO date-only `LocalDate` values under the server-owned Tenant civil-date semantics established by **Define canonical academic authorization context**.

An endpoint becoming inactive or archived immediately makes the relationship ineligible for current authorization on the next request even if the assignment row still says `active`. The history remains readable to explicitly authorized historical operations. Reactivating an endpoint does not silently restore authority from an ended or cancelled assignment; a currently active, effective, otherwise eligible assignment must exist.

### Lifecycle

Lifecycle is explicit and forward-only; dates never transition status automatically:

```text
planned ──activate──> active ──end──> ended
   └──────cancel────> cancelled
```

- **planned** records a complete future or Draft-year intent. It never grants current or historical teaching authority.
- **active** is the only status that can grant teaching-assignment scope, and only inside the effective interval while every endpoint remains eligible.
- **ended** is terminal history created by an explicit end or atomic replacement. It never grants current authority, but may support a policy-approved historical operation at a date within its former interval.
- **cancelled** is terminal history for a planned assignment that will not take effect. It never grants authority.

Activation requires the Tahun Ajaran and Rombongan Belajar to be active and unarchived, the subject and teacher to be eligible, `startsOn <= activation effective date`, and no forbidden overlap. A future `startsOn` remains `planned`; reaching that date does not activate it. This follows the domain rule that academic lifecycle is advanced explicitly rather than by the calendar.

New planning is allowed only against a Draft Tahun Ajaran/Rombongan Belajar or as an explicitly supported future plan for an otherwise eligible academic context. It must not grant access before activation. New active assignments cannot be created against Draft, closed, cancelled, or archived academic aggregates.

Ending an active assignment sets `endsOn` to the effective end date, transitions to `ended`, increments the version, and preserves the row. Cancelling affects only `planned`. Terminal rows are never reopened. A correction that changes teacher, subject, class, year, or an already-effective start creates a superseding row through an audited atomic end-and-create operation; it does not rewrite historical tuple identity.

Planned rows may update `startsOn`, reason, or tuple endpoints only through an explicit permissioned command using `expectedVersion`; changing an endpoint revalidates the entire tuple and overlap set. Once active, tuple endpoints and `startsOn` are immutable.

### Overlap and cardinality

Two non-cancelled assignments for the exact same `(tenantId, teacherProfileId, subjectId, classGroupId, academicYearId)` must not have overlapping effective intervals. This prevents duplicate authorization proofs and double counting. The invariant applies to planned/planned, planned/active, and active/active intervals and must be enforced transactionally with locking because an open-row uniqueness key alone cannot prevent every bounded-date overlap.

The aggregate does **not** impose broader uniqueness:

- one Guru may teach the same Mata Pelajaran to multiple Rombongan Belajar;
- one Guru may teach multiple Mata Pelajaran to one Rombongan Belajar;
- one Rombongan Belajar may have multiple Mata Pelajaran; and
- one Mata Pelajaran in one Rombongan Belajar may have multiple eligible Guru for legitimate co-teaching.

Each co-teacher needs their own complete Penugasan Mengajar row. Wali Kelas does not count as a co-teacher and never occupies or satisfies a teaching-assignment slot. Teaching-load limits or a single-primary-teacher rule require a separate future domain decision and cannot be inferred here.

Replacement of an exact tuple on date D atomically ends the prior active row at D and creates/activates the replacement beginning at D. The half-open intervals do not overlap. A failed close, overlap check, endpoint revalidation, insert, audit append, or version check rolls back the entire replacement.

### Audit and optimistic concurrency

Every Penugasan Mengajar starts at `version = 1`. Every successful planned edit, activation, end, cancellation, or replacement increments the affected row's version. Commands accept `expectedVersion` only as an untrusted comparison token; they reload the row by verified Tenant and ID and use version-qualified writes. Concurrent commands produce a recoverable conflict only after current permission and scope are re-proven.

Append one immutable Tenant-qualified history event in the same transaction as each state change:

```ts
type TeachingAssignmentEvent = Readonly<{
  id: TeachingAssignmentEventId
  tenantId: TenantId
  teachingAssignmentId: TeachingAssignmentId
  actorUserId: UserId
  operation: "created" | "planned-updated" | "activated" |
             "ended" | "cancelled" | "replaced"
  fromVersion: number
  toVersion: number
  effectiveOn: LocalDate
  reason: string
  occurredAt: Instant
  replacementAssignmentId?: TeachingAssignmentId
}>
```

The actor is resolved from current server authentication/worker policy and must be an eligible same-Tenant audit actor; the browser cannot provide it authoritatively. `createdByUserId` and event actor IDs are provenance only and never grant Self or Assigned scope. Reasons are required for lifecycle changes and replacement. Mutation and audit commit atomically.

Hard deletion is forbidden. History remains available for audit and explicitly authorized historical reporting. Ordinary edits must not overwrite who taught what, where, or when.

### Authorization eligibility

A Penugasan Mengajar proves Assigned class-and-subject scope only if one authoritative query establishes all of the following at the operation's `effectiveAt`:

1. the verified Tenant matches the assignment and every endpoint;
2. the assignment's `teacherProfileId` is the eligible Profil Guru reached through the current principal's unambiguous same-Tenant account/person/profile linkage;
3. assignment status is `active`;
4. the half-open interval contains `effectiveAt`;
5. the assignment's exact `subjectId`, `classGroupId`, and `academicYearId` match the protected resource chain;
6. `classGroup.academicYearId` equals the assignment's `academicYearId`;
7. teacher, subject, class, and year satisfy current endpoint eligibility and lifecycle rules; and
8. the requested operation's code-owned policy explicitly admits Teaching Assignment as a scope arm.

For an authorized historical operation, an `ended` assignment may prove former scope only when its former interval contains the policy-approved historical date and the operation explicitly admits historical teaching relationships. It never grants current access. `planned` and `cancelled` never prove scope at any date.

The scope query must join the complete tuple in one path. A teacher assignment for Mathematics in 10-A and Biology in 10-B cannot authorize Mathematics in 10-B. A subject catalog entry plus Wali Kelas status, class membership, role name, profile type, timetable label, or separate partial assignments cannot complete the proof.

Multiple eligible assignment rows may union reachable records across complete policy arms, but results are deduplicated before count, sort, pagination, aggregation, or export. No relationship ID or client-supplied scope selector broadens the operation-owned policy.

### Failure and concealment behavior

- **Missing/nonexistent:** no complete row means no Assigned class-and-subject scope. A direct protected resource follows the concealed not-found contract; collections omit it.
- **Foreign Tenant:** Tenant-qualified joins treat foreign rows or endpoints exactly like nonexistent records externally and emit an internal isolation signal where inconsistency is detected.
- **Archived/ineligible endpoint:** the assignment grants nothing immediately, regardless of its stored status. Mutations fail after authoritative revalidation; historical data remains preserved.
- **Expired/ended:** an interval not containing `effectiveAt`, or status `ended` for a current operation, grants nothing.
- **Overlapping/ambiguous:** if persisted data contains a forbidden overlap or inconsistent duplicate, the evaluator does not choose a convenient row. It fails the affected scope closed and emits an integrity/security signal.
- **Future-effective/planned:** it is visible only to an explicitly authorized planning/administration operation and grants no teaching authority before explicit activation.
- **Stale:** a changed version, lifecycle, endpoint, relationship, entitlement, permission, or Tenant state discovered during commit causes no partial write. Concealed scope loss is reported before version conflict disclosure.

Reads, previews, exports, server actions, route handlers, and workers all use the centralized academic evaluator. Every mutation rechecks the complete tuple, actor authority, endpoint eligibility, overlaps, lifecycle, and versions inside the transaction before the first write, following the preview/commit protocol defined by the next decision.

### Persistence and validation implications

Implementation must add a Tenant-qualified teaching-assignment table and immutable event/history table, interval and status/date checks, composite endpoint ownership, indexes supporting exact current scope joins and history, and transactional overlap protection. Database constraints are defense in depth; the server evaluator still validates all invariants.

Required test evidence includes:

- two-Tenant attempts with each foreign endpoint independently substituted;
- missing, inactive, archived, Draft, closed, cancelled, ended, expired, and future/planned states;
- exact interval boundaries and Tenant civil-date behavior;
- exact duplicate overlap races and non-overlapping replacement on the same date;
- allowed co-teaching and a teacher's multiple legitimate class/subject tuples;
- Cartesian-product denial across separately valid class and subject facts;
- Wali Kelas never implying subject-teaching authority;
- account/profile unlinking and endpoint archival revoking scope on the next request;
- stale version and concurrent end/replacement rollback with atomic audit; and
- collection predicates, counts, exports, and direct concealed lookup behavior.

Until those implementation and validation conditions are satisfied, every operation requiring Assigned class-and-subject scope remains denied for delegated users.
