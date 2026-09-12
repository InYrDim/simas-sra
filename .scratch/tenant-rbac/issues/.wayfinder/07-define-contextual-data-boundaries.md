# Define contextual data boundaries

Type: grilling
Status: resolved
Blocked by: 03, 06

## Question

How should capability permissions compose with domain constraints such as assigned classes, subjects, units, and self-owned records without encoding those relationships as role names or bypassing Tenant isolation?

## Answer

### Decision

Tenant RBAC answers **what business operation an Akun Pengguna may attempt**; authoritative Tenant-owned domain relationships answer **which records are in scope for that operation**. Authorization is granted only when all independent gates pass:

1. the request resolves to the principal's exact Tenant;
2. the relevant feature and Tenant operational state permit the operation;
3. the principal has the exact Permission Tenant required by the operation; and
4. the operation's typed contextual policy proves that the target record is in scope from current authoritative relationships.

In shorthand: `allow = same Tenant AND entitlement/state AND permission AND contextual scope AND domain invariants`. No role name, profile type, client-supplied scope, or one successful gate can substitute for another. Unknown resource types, unsupported scope strategies, missing relationships, malformed references, and ambiguous ownership fail closed.

School Admin is the sole bypass of an operation's otherwise narrower contextual policy because its authority is Provider-owned system policy. For example, School Admin system policy may administer all same-Tenant student records even where the delegated `students.students.view` operation also supports Assigned or Self policy arms. This bypass removes only ordinary record-scope restrictions; it does not bypass Tenant isolation, feature or operational restrictions, sensitive-field permissions, domain invariants, optimistic concurrency, or audit requirements.

This is distinct from an operation whose code-owned contextual policy is intrinsically Tenant-wide. Issue 13 maps many current administrative operations that way because their business capability applies to all same-Tenant records and no narrower relationship is part of the operation. A custom Role Tenant may invoke such an operation when it holds the exact permission, but it receives only that operation's fixed same-Tenant policy—not School Admin's ability to bypass narrower policies on other operations. Custom roles cannot acquire a generic Tenant-wide scope by name, permission combination, role setting, or separately grantable scope bit.

### Context is domain data, not RBAC data

Role Tenant assignments remain additive capability grants. Assigned Rombongan Belajar, Mata Pelajaran, unit kerja, Wali Kelas, and similar relationships remain lifecycle-aware domain facts and are not copied into role names or persisted as arbitrary role scope lists. A label such as `Guru Matematika Kelas 10` has no authorization meaning.

Each protected operation must select one code-owned, typed contextual policy appropriate to its aggregate. The initial policy vocabulary is:

- **Tenant-wide**: the operation's code-owned policy intrinsically places every same-Tenant record of the resource in scope. A custom role holding that operation's exact permission may use this fixed policy. Tenant-wide is not a generic grantable scope bit and does not carry over to any operation whose policy is Assigned, Unit, or Self. School Admin reaches the same-Tenant set either through an intrinsically Tenant-wide operation or through its separate system-policy bypass of an otherwise narrower operation.
- **Assigned relationship**: the record is reachable through a current canonical assignment involving the principal's linked Warga Sekolah profile, such as a Wali Kelas assignment, teaching assignment, or advisor assignment.
- **Unit relationship**: the record belongs to a current canonical unit and the principal has a current assignment to that same unit.
- **Self**: the record is explicitly linked to the principal's Akun Pengguna through a same-Tenant identity relationship.

These are code-owned operation-policy concepts, not assignable permission suffixes, role scope options, independently grantable bits, or user-configurable expressions. Holding a permission selects only the contextual policy fixed for that operation; it never lets a role author choose Tenant-wide instead of a narrower policy. A module may expose separate business permissions when self-service and administration are materially different capabilities, but it must still evaluate the relevant contextual policy. Generic, Tenant-configurable ABAC or a scope DSL is out of scope.

### Assigned classes and subjects

Access through an assigned Rombongan Belajar or Mata Pelajaran is based on a current, same-Tenant, effective relationship whose endpoint is the principal's linked Profil Guru or other applicable profile. Merely having a Profil Guru grants nothing, and an unlinked Profil Guru cannot establish the current Akun Pengguna's scope.

Where access depends on both class and subject, the proof must be a canonical assignment tuple connecting the principal, Rombongan Belajar, Mata Pelajaran, and applicable Tahun Ajaran/Semester. Independent assignments must not be combined into a Cartesian product. For example, assignment to Mathematics in class 10-A and Biology in class 10-B does not permit Mathematics records for 10-B. A Wali Kelas relationship may grant the class-based policy arms explicitly defined for homeroom responsibilities, but it does not imply assignment to every Mata Pelajaran taught to that class.

The current schema has effective-dated `homeroom_assignment` and `class_membership` records, but no canonical teaching-assignment relation joining Guru, Rombongan Belajar, and Mata Pelajaran. Therefore subject-and-class-scoped teacher authorization must fail closed until that domain relation exists; implementations must not infer it from role names, the Mata Pelajaran catalog, free-text labels, or unrelated assignments.

Student records reached through a Rombongan Belajar use the applicable Keanggotaan Rombongan Belajar at the policy's effective time. Planned membership does not grant current operational access. Historical membership grants historical access only to an operation explicitly defined to inspect that historical period; it does not keep a former student in current class scope.

### Units

Unit scope requires stable, Tenant-owned unit identity and effective-dated membership or responsibility relationships. String equality, display labels, staff position names, prefixes, or case-normalized text are insufficient security boundaries.

The current `staff_position_assignment.workUnit` is nullable free text. It may be displayed as domain information but must not authorize access. Any feature requiring unit-scoped enforcement must first define a canonical unit aggregate with same-Tenant identifiers and effective relationships. Until then, that operation must use another explicitly supported policy (for example, self or Tenant-wide with the proper permission) or fail closed; it must not silently approximate unit scope.

Unit hierarchies do not imply descendant access unless the relevant domain policy explicitly declares that containment rule. Moving a record or person between units changes scope according to the authoritative effective relationship; an old unit label or historical assignment grants no current access.

### Self-owned records

“Self” means an explicit identity linkage, not “created by me,” “assigned to my role,” matching email, or possession of an opaque record ID. For Warga Sekolah data, the current schema's same-Tenant `school_person.accountUserId -> user.id` relationship is the identity proof. A Profil Guru, Profil Staf, or Profil Siswa attached to that Warga Sekolah is self only through that linkage.

`createdByUserId` and audit `actorUserId` fields record provenance and never establish ownership unless a resource's domain model separately defines creator ownership in a future decision. Consequently, a staff member who created an import, student, asset, or assignment does not retain access merely because their user ID appears in its audit trail.

Self access is record-specific and field-sensitive. It does not automatically allow edits, lifecycle transitions, role assignment, access to another profile attached to the same person, or sensitive fields. The operation still requires its exact permission, and `view-sensitive`, `view-contact`, or another explicit permission remains necessary where issue 03 requires it. If an Akun Pengguna is unlinked, linked across a different Tenant, or linked ambiguously, self scope fails closed.

### Composition and multiple relationships

Multiple active Role Tenant entries union permissions, and multiple valid domain relationships union the records reachable through the contextual policy's declared alternatives. They do not broaden the meaning of any individual relationship.

Within one required relationship path, all dimensions are conjunctive. Across policy arms explicitly declared by the resource, a record may be allowed by any complete arm. For example, a teacher could see a student because the student is currently in the teacher's Wali Kelas, or because a canonical teaching assignment for that exact class/subject permits the specific operation. An incomplete class proof plus an incomplete subject proof from another assignment never combines into access.

Context never flows transitively through arbitrary graph edges. Every allowed path must be enumerated by the typed domain authorizer so adding a new relationship table cannot accidentally expand access.

### Record access and collection filtering

A direct record lookup must constrain by the verified Tenant before evaluating context. Missing records, cross-Tenant IDs, and same-Tenant records outside contextual scope all produce the same external `404` behavior defined by issue 06. Internal diagnostics may distinguish `tenant-mismatch` and `scope-denied`, but must not disclose record existence or foreign-Tenant identifiers to the caller.

Collection endpoints must apply the exact same contextual predicate in the authoritative query before sorting, pagination, aggregation, export, or search facets. Fetching a Tenant-wide page and filtering it afterward is forbidden because it can leak records through totals, page counts, ordering gaps, facets, timing, memory pressure, or export contents. Counts and summaries are computed over the authorized subset only.

Filtering rules include:

- start from the verified `tenantId`; never trust a browser-provided Tenant identifier;
- derive assignment/profile identifiers from the persisted current principal, not query parameters;
- use canonical same-Tenant relationship joins and effective-time predicates;
- deduplicate records reachable through multiple valid relationships before counting or paginating;
- apply sensitive-field projection independently from row scope;
- reject or ignore unsupported client scope selectors rather than interpreting them as authority; and
- use the identical scope semantics for list, detail, search, autocomplete, download, export, bulk preview, and mutation target selection.

An empty authorized collection returns an empty result, not `403`. Lacking the collection permission returns `403`; requesting a specific inaccessible record returns `404`.

### Relationship freshness and stale state

Context is evaluated from authoritative persisted relationships on every protected request, with request-local memoization only. Session claims, cookies, URLs, hidden form fields, prior page loads, and cross-request caches are not relationship authority.

A relationship is current only when all required same-Tenant endpoints exist and are eligible and the relationship is effective at the operation's policy time. Unless an operation explicitly supplies an authorized historical effective date, policy time is the server's current time. Future/planned relationships do not grant current access; ended, replaced, suspended, archived, invalid, or otherwise inactive relationships do not grant current access. Profile lifecycle and account linkage requirements are checked as part of the complete path.

Revoking or ending an assignment is observed on the next request. A page already rendered is not authority for a later action. Reactivating a profile or record does not silently restore old contextual access: a currently effective eligible relationship must exist. Historical relationships remain available for authorized history and audit operations but confer no present operational scope.

If data is internally inconsistent—for example, overlapping “current” assignments where the domain promises one, a relationship points to an ineligible profile, or a Tenant endpoint does not match—the evaluator fails closed and emits an internal integrity/security signal. It must not pick a convenient relationship.

### Mutation revalidation

Every mutation first performs the normal permission and contextual check, but that precheck is explanatory only. Inside the mutation transaction, before writing, the server must reload and revalidate:

- the actor's active account, exact Tenant membership, School Admin authority or effective Role Tenant grants, and required permission;
- Tenant operational state and feature entitlement;
- the target aggregate by both verified `tenantId` and record ID;
- the complete contextual relationship path, including identity linkage, effective dates, endpoint eligibility, and any class/subject/unit tuple;
- target and relationship versions or equivalent concurrency predicates; and
- all domain invariants and every target in a bulk operation.

The write must use Tenant-qualified and version-qualified predicates. The mutation and audit event commit atomically. If authority, target state, or a contextual relationship changed after preview or initial load, the operation applies no changes. A same-Tenant scope loss returns the mutation's concealed not-found result; stale versions use the domain's conflict result without revealing inaccessible current state. Bulk operations are all-or-nothing when any item is cross-Tenant, out of scope, stale, or invalid, and the response must not identify a concealed foreign record.

Changing the relationship that supplies the actor's own scope requires special care: the transaction must validate authority against the pre-change state, validate that the actor is allowed to perform that relationship-management operation, apply the change, and ensure any required post-change invariant. The actor does not retain authority for later mutations merely because the same transaction ended their assignment.

### Concrete edge cases

- A Guru has the admitted `students.students.view` permission, but the invoked operation uses its Assigned/Self policy arms and the Guru has no current class, teaching, advisor, or self relationship to student S. S is omitted from collections and direct access returns `404`; the permission is not a generic Tenant-wide scope grant.
- A Guru is Wali Kelas for 10-A and has the required student-view permission. Current students of 10-A are in scope for policy arms explicitly granted to Wali Kelas; planned entrants and former members are not.
- A Guru teaches Mathematics in 10-A and Biology in 10-B. A Mathematics assessment in 10-B is out of scope even though both the class and subject appear separately among the Guru's assignments.
- A Guru has the required permission and a subject catalog contains Mathematics, but no canonical teaching assignment exists. Access fails closed; catalog presence is not assignment.
- A Staf has a current free-text `workUnit` of `Perpustakaan`. That text cannot authorize library records. Unit-scoped access waits for canonical unit identity/assignment or uses another explicitly selected policy.
- An Akun Pengguna is linked to Warga Sekolah P, which has both Profil Guru and Profil Staf. P's self fields may be in scope for an explicit self operation, but the linkage alone does not grant teacher/staff administration or sensitive-field access.
- User A created an asset later assigned to another custodian. `createdByUserId = A` is provenance, not self ownership; A needs the normal permission and contextual policy.
- A teacher opens a student edit page, then their Wali Kelas assignment ends. Submission reloads the relationship and is rejected without applying the stale edit.
- A class transfer and teacher bulk update race. The transaction rechecks every student's current membership; if one moved out of scope, the entire bulk mutation fails.
- A caller substitutes a record ID from another Tenant. The query is Tenant-qualified, returns no authorized record, and externally behaves exactly like an unknown ID.
- A record is reachable through two valid assignments. It appears once in the collection, contributes once to totals, and remains accessible if either complete path remains current.
- A historical report explicitly authorized for Tahun Ajaran 2025/2026 evaluates relationships for that bounded historical period. Those relationships do not grant access to current operational student records outside the report.

### Evidence and implications for later specification

This policy preserves issue 03's separation of Permission Tenant from data-scope rules and issue 06's ordered, fail-closed evaluator, `403`/`404` concealment contract, next-request freshness, and transactional revalidation. It also follows the domain glossary's separation of Akun Pengguna, Warga Sekolah, profiles, Role Tenant, Mata Pelajaran, Rombongan Belajar, Keanggotaan Rombongan Belajar, and Wali Kelas.

The current authorization code is narrower than this target: `tenant-access.ts` resolves session/domain activation, while `tenant-master-data-access.ts` admits only `school-admin` and checks record Tenant ownership. Existing domain data nevertheless supplies useful invariants for later implementation: composite Tenant foreign keys are widespread; `school_person.accountUserId` is a same-Tenant account linkage; class membership and homeroom assignments are effective-dated; records use optimistic versions; and stores commonly Tenant-qualify reads and writes. Conversely, the absence of a teaching-assignment tuple and the free-text nature of `staff_position_assignment.workUnit` are explicit gaps and must not be papered over by RBAC policy.

Later operation mapping must name, for every protected operation, its exact Permission Tenant, contextual policy arm(s), relationship and effective-time semantics, sensitive-field projection, direct-record denial behavior, collection predicate, and mutation revalidation set. If that mapping cannot identify an authoritative canonical relationship, the operation is not ready for scoped delegation and must remain School Admin-only or fail closed.
