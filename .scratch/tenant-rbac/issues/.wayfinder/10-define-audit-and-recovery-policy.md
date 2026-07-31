# Define the audit and recovery policy

Type: grilling
Status: resolved
Blocked by: 04, 05, 06, 09, 14

## Question

Which role, permission, assignment, denial, and School Admin lifecycle events must be recorded; what actor, reason, before/after, retention, visibility, and recovery semantics make changes explainable and supportable?

## Answer

### Policy boundary and invariants

Tenant RBAC uses an append-only **security audit event** stream for successful authorization changes and a separate **denial telemetry** stream for failed authorization evaluations. Audit is evidence and explanation, not the source of current authority: persisted School Admin status, active Role Tenant assignments, active role versions, and the code-owned Permission Tenant registry remain authoritative.

The following invariants apply:

- every event has one immutable ID, UTC `occurredAt`, schema version, event type, outcome, security-context kind, authoritative actor, Tenant context when one exists, target references, correlation/request ID, and sanitized metadata;
- event types are stable machine-readable names, not translated labels or free text;
- successful security mutations and their audit events commit atomically; a mutation without its required audit event fails and rolls back;
- audit records cannot grant access, be edited, or be deleted by Tenant or ordinary Provider workflows;
- browser-provided actor, Tenant, before-state, diff, timestamp, outcome, or target labels are never trusted;
- all reads and writes fail closed across the Provider/Tenant boundary; a Tenant event never leaks into another Tenant's view;
- timestamps describe when SIMAS committed the event. If a lifecycle action has a separate effective date, record both and never backdate `occurredAt`.

### Event taxonomy

Use namespaced event types with a versioned payload contract.

**Role Tenant and Template Role Tenant**

- `tenant_role.created`, `.renamed`, `.permissions_changed`, `.activated`, `.moved_to_draft`, `.archived`, `.restored_to_draft`, and `.copied`;
- `tenant_role.template_update_applied` when a School Admin explicitly accepts a newer template comparison;
- registry/deployment events `permission_catalog.version_activated`, `.key_deprecated`, and `.key_removed`, emitted once per deployed catalog version by the system, with affected-role and affected-assignment counts. Ordinary catalog reads and unchanged deployments are not events.

Copy events identify the new role and its `copiedFromRoleId` or `templateKey`/`templateVersion`, but do not copy source history. Renames retain immutable role ID plus the role-name snapshot before and after.

**Role assignment and account access**

- `tenant_assignment.roles_replaced` for the atomic complete-set save, containing role IDs added/removed and effective Permission Tenant keys gained/lost;
- `tenant_assignment.bulk_roles_changed`, a summary event, plus one `tenant_assignment.roles_replaced` child per changed Akun Pengguna joined by `batchId`;
- `tenant_assignment.suspension_summary` when account deactivation suspends zero or more assignments, plus exactly one `tenant_assignment.suspended` child for each assignment whose state changes;
- `tenant_assignment.reactivation_decided` when reactivation explicitly restores a validated subset or chooses zero roles, plus exactly one `tenant_assignment.restored` child for each assignment restored. The summary records the former, selected, rejected-as-invalid, and resulting assignment sets;
- `tenant_account.zero_role_entered` and `.zero_role_exited` when a successful operation crosses that boundary. These may share the same correlation ID as the assignment event.

Unchanged bulk targets are counted in the summary but do not receive a misleading mutation event. Failed or rolled-back assignment attempts produce denial/operation telemetry, not successful audit events.

**Non-admin Tenant Akun Pengguna lifecycle**

The canonical lifecycle events for an ordinary, non-School-Admin Tenant account are:

- `tenant_account.created` when an account is created directly and `tenant_account.invited` when creation includes an activation invitation;
- `tenant_account.invitation_resent` when the same still-valid activation material is delivered again, and `tenant_account.activation_reissued` when prior activation material is revoked and replaced. Resend and reissue are distinct and idempotent operations;
- `tenant_account.activated` when control is proven and the account first becomes usable;
- `tenant_account.profile_linked` and `.profile_unlinked` when the optional same-Tenant Warga Sekolah link changes. These events never imply a role grant or revocation;
- `tenant_account.deactivated` and `.reactivated`; each account lifecycle command emits exactly one parent event. Deactivation may additionally emit one `tenant_assignment.suspension_summary` and one `tenant_assignment.suspended` child per changed assignment. Reactivation emits one `tenant_assignment.reactivation_decided` summary and one `tenant_assignment.restored` child per explicitly restored assignment; it never silently restores roles;
- `tenant_account.credential_recovery_started`, `.credential_recovery_cancelled`, and `.credential_recovery_completed` when SIMAS owns a recovery workflow. Routine authentication failures are denial telemetry, not lifecycle events.

These events use the same envelope, transactionality, tamper resistance, Tenant-lifetime-plus-seven-year retention, post-deletion minimization, and legal-hold rules as RBAC mutation events. Their payload records account ID and safe identity snapshot, account/lifecycle `fromVersion`/`toVersion` and status before/after, authoritative Tenant binding, optional linked `personId` plus link state before/after, invitation/recovery case ID, delivery channel and attempt count where relevant, assignment-suspension/restoration event IDs, session/token revocation counts, actor, reason, and correlation fields. It never records credentials, activation/recovery tokens or hashes, password hashes, session identifiers, raw delivery payloads, Warga Sekolah profile contents, or recovery answers.

School Admin can see and export lifecycle events for non-admin accounts in their verified Tenant, including activation state, profile-link state, deactivation/reactivation, role-suspension consequences, actor, reason, and time. Delivery diagnostics, network metadata, token state, recovery-security details, and Provider/internal notes remain Provider-security-only. The affected account's optional self-history is governed separately below. Events for School Admin accounts remain Provider-visible under the School Admin policy and are not exposed through this non-admin lifecycle view.

**Provider-owned School Admin lifecycle**

Issue 09's model is canonical and uses two independent axes:

- `authorityState: none | active | disabled` answers whether the account currently has Provider-owned School Admin authority;
- `proofState: pending | completed | expired | cancelled` describes the current nomination or recovery proof ceremony and never grants authority by itself.

Do not encode proof progress as an authority state, and do not use `pending` or `suspended` as School Admin `authorityState` values. The canonical lifecycle events are exactly:

- `school_admin.nomination_created`: creates/refreshes the nomination case with `authorityState: none` and `proofState: pending`; `authorityChanged: false`;
- `school_admin.account_control_proof_completed`: records nomination proof `pending → completed` while authority remains `none`; `authorityChanged: false`;
- `school_admin.authority_granted`: changes `authorityState: none → active` after completed proof for initial creation, an additional School Admin, or applicant promotion; `authorityChanged: true`;
- `school_admin.authority_disabled`: changes `authorityState: active → disabled`; `authorityChanged: true`;
- `school_admin.replacement_cutover_completed`: atomically grants the proved successor and disables only the selected incumbent at cutover, records both accounts' authority before/after plus active-admin sets/counts, and leaves other active School Admins unchanged; `authorityChanged: true`;
- `school_admin.recovery_proof_completed`: records recovery proof `pending → completed` without changing `authorityState`; `authorityChanged: false`;
- `school_admin.authority_reactivated`: changes `authorityState: disabled → active` only after completed recovery proof and Provider confirmation; `authorityChanged: true`.

These seven names are exhaustive for canonical School Admin lifecycle audit and have no aliases. Nomination/recovery expiry or cancellation is represented by the authoritative `proofState` transition in the relevant case history and payload, not by inventing another authority event.

Auxiliary delivery and credential operations may emit clearly noncanonical events under `school_admin.credential.*`, such as `school_admin.credential.delivery_resent`, `.activation_material_reissued`, `.temporary_credential_issued`, and `.temporary_credential_reissued`. They always record `authorityChanged: false`, cannot change either authority or proof to `completed`, and cannot be interpreted as lifecycle authority. Credential events record issuance/reissuance and delivery-channel metadata, never the credential, password, reset token, session token, token digest, or recoverable secret. Tenant custom-role events can never represent School Admin lifecycle changes.

**Authorization and integrity signals**

- successful permission checks are not audited per request;
- structured denials use the internal reason codes fixed by issue 06: `no-session`, `tenant-mismatch`, `account-inactive`, `entitlement-disabled`, `unknown-permission`, `permission-denied`, and `scope-denied`, with additional stable codes for incomplete activation, Tenant restriction/read-only state, stale version, invalid target state, and recovery-policy blocks;
- `unknown-permission`, cross-Tenant attempts, attempts to mutate School Admin through Tenant RBAC, audit-write failures, integrity-verification failures, repeated denials, and attempted audit mutation/deletion are security alerts, not merely ordinary logs.

### Actor model

Every audit actor is one of:

- `tenant-user`: authenticated Akun Pengguna; record immutable `actorUserId`, verified `tenantId`, actor kind, and a display-name/email snapshot for support continuity;
- `provider-admin`: authenticated Provider Admin; record `actorUserId` and Provider security context, with the affected `tenantId` separately. Provider Admin is never represented as a Tenant principal;
- `system`: a named code-owned component or deployment identity such as `permission-catalog-deploy`; record `actorService`, release/job ID, and initiating human event/case where applicable;
- `support-recovery`: the authenticated Provider Admin performing a recovery, plus mandatory `recoveryCaseId`. This is a classification of Provider action, not an anonymous shared actor.

Impersonation is not assumed or permitted by this policy. If introduced later, events must record both the authenticated Provider actor and the effective Tenant principal and must be visibly marked; recording only the impersonated identity is forbidden. Deleted or renamed users do not erase actor snapshots or IDs.

### Before, after, diff, and event envelope

Successful mutation events store the minimum complete security state needed to explain access:

- immutable IDs and safe name snapshots for role and target Akun Pengguna;
- object `fromVersion`/`toVersion`, lifecycle before/after, assignment before/after, and sorted Permission Tenant keys before/after;
- a normalized diff (`added`, `removed`) and affected-assignment/affected-user counts;
- permission risk classifications and template/catalog versions used for validation;
- `batchId`, `correlationId`, `requestId`, and `recoveryCaseId` when applicable;
- the server-derived reason and outcome.

Do not snapshot unrelated Akun Pengguna, Warga Sekolah, profile, session, credential, or record content. Do not store authorization headers, cookies, request bodies, query strings, IP addresses containing credentials, or secrets. IP address and user-agent may be retained only in restricted Provider telemetry for authentication/recovery and high-risk denials, normalized to a bounded length; they are excluded from Tenant-visible audit. Sensitive values that are unnecessary for explaining authorization are omitted rather than merely masked.

For a registry deployment, store catalog version/digest and key-level changes, not executable registry source. For a denial, store only IDs already known from authoritative resolution, the requested permission key, entry-point/operation identifier, coarse resource type, status class, reason code, and correlation fields. Never store or reveal a cross-Tenant target's name, existence, payload, or raw identifier in Tenant-visible data; restricted telemetry may use an HMAC-pseudonymized target identifier for correlation.

### Reasons

Reasons follow issue 05: mandatory for revocation, sensitive/critical grants, bulk operations, assignment restoration, any zero-role result, active-role permission removal, role deactivation/archive, every School Admin disable/replacement/recovery, and every Provider override. Standard low-risk single-user grants, role creation, rename, and draft editing may use a code-owned default reason when the user supplies none.

User-entered reasons are trimmed, length-limited to 1–1000 Unicode characters when required, stored as plain text, rendered with normal output escaping, and rejected if empty after normalization. UI warns not to enter credentials, secrets, medical/student details, or other unnecessary personal data. Reasons are never interpreted as authorization instructions. Corrections do not edit an event: append `security_audit.annotation_added` with its own actor, reason, target event ID, and timestamp. An annotation cannot change the recorded outcome or before/after state.

### Retention and deletion

- successful RBAC and School Admin lifecycle audit events: retain for the Tenant lifetime plus seven years after Penghapusan Tenant completes, unless a longer legal hold applies;
- denial telemetry: retain searchable detail for 90 days and daily aggregate counts for 13 months; confirmed incident evidence may be copied into a restricted security case and retained for seven years;
- alert and integrity-verification records: retain for seven years;
- legal hold suspends expiry for the named records and is itself audited.

Penghapusan Tenant removes operational Tenant data as defined by its deletion policy, but preserves only the minimum security evidence necessary for Provider legal/security obligations. Post-deletion audit evidence replaces direct Tenant/user identifiers with stable case-scoped pseudonyms, removes display snapshots, free-text reasons, IP/user-agent, and other Tenant operational content, and remains Provider-security-only. This avoids turning the audit store into a shadow Tenant archive. Expiry is performed by a privileged retention job, emits a retained aggregate deletion certificate, and cannot be initiated by School Admin.

### Visibility, export, and redaction

School Admin may view and export audit events for their verified Tenant concerning Role Tenant, Permission Tenant impact, assignments, and their own access state. Tenant-visible events show actor display snapshot, target, event type, time, reason, before/after access diff, and batch/correlation reference. School Admin cannot view restricted authentication telemetry, IP/user-agent, Provider-internal notes, alert rules, integrity material, another Tenant, or credential/recovery secrets.

Provider Admin may view School Admin lifecycle events and restricted security telemetry only through Provider authorization. Provider support views default to redacted fields; access to raw network metadata or post-deletion evidence requires a security/support purpose, is itself audited, and is unavailable to Tenant principals.

**Decision: limited self-history is a system-internal self-service policy, not a Permission Tenant capability.** An affected non-admin Akun Pengguna may see only a server-derived history of their own account creation/activation state, profile-link state, deactivation/reactivation, effective Role Tenant changes, and user-visible reasons. This access is inherent to the authenticated account settings surface, cannot be granted for another user through a custom role, cannot be used to browse audit or denial streams, and remains available to a zero-role account. It excludes actor email snapshots beyond a safe display name, other users, role-wide affected-user counts, Provider actions/notes, delivery and recovery-security metadata, network data, denial telemetry, integrity fields, and School Admin lifecycle events. The server binds the subject to the current persisted `userId` and verified Tenant; no caller-supplied target user or Tenant is accepted. This is a narrow projection over retained audit data, not general audit-log authorization or a new recovery mechanism.

Exports apply the same authorization and redaction as the screen, are generated server-side, are Tenant-scoped, have a bounded date range, and create `security_audit.exported` with actor, filters, row count, and export ID. Spreadsheet exports neutralize formula-leading cells. Audit search never accepts Tenant ID as authority from the browser.

### Denial telemetry and alerting

Record every high-risk denial: cross-Tenant/Tenant mismatch, unknown permission, School Admin boundary violation, Provider/Tenant context confusion, recovery denial, audit-integrity failure, and sensitive/critical mutation denial. For ordinary `permission-denied`, `scope-denied`, unauthenticated probes, and entitlement/read-only denials, keep rate-limited structured telemetry with counters so hostile repetition remains visible without allowing log-volume denial of service.

Rate limiting may aggregate repeated events by reason code, entry point, Tenant or pseudonymous source, actor, and short time bucket; it must preserve first/last occurrence and count. It must never make the authorization decision permissive. Alerts trigger on any integrity/audit-write failure or unknown permission in production, and on configurable repeated cross-Tenant, School Admin boundary, recovery, or sensitive-mutation denials. Alert thresholds and destinations are Provider-security configuration, not Tenant-editable policy. User responses remain the non-enumerating `401`/`403`/`404` contract from issue 06 and never expose internal reason codes.

### Tamper resistance and integrity

The primary audit table is insert-only for application roles: no update/delete privilege, no cascade from mutable role, assignment, user, or Tenant tables, immutable event IDs, foreign references that tolerate target deletion, and database constraints for Tenant/context consistency. The application writes through one narrow audit interface; retention deletion uses a separate least-privileged job identity.

Each event stores a canonical-payload digest and a hash-chain link (`previousHash`, `eventHash`). The chain partition key is `(securityContextKind, contextId)`: Tenant-context events use `("tenant", tenantId)` including Provider actions affecting that Tenant; Provider-global events use `("provider", providerInstanceId)`; post-deletion records remain in their original Tenant partition under its pseudonymized context ID. This prevents a global hot row while preserving one ordered history for every Tenant across Tenant, Provider, and system actors.

Every partition has one transactional head row containing `nextSequence` and `headHash`. Before inserting events, the writer locks that row `FOR UPDATE`, allocates a contiguous sequence range, and updates the head in the same transaction as the mutation and events. A transaction producing multiple events supplies a deterministic local order fixed by the command contract: parent/summary event first, then child events sorted by immutable target ID and event type, then consequence events; each receives the next sequence and hashes the immediately preceding event, including earlier events in that transaction. For non-admin account deactivation the exact order is: one `tenant_account.deactivated` parent, then the optional `tenant_assignment.suspension_summary`, then `tenant_assignment.suspended` children sorted by immutable assignment ID. For reactivation/restoration the equivalent order is: one `tenant_account.reactivated` parent, then one `tenant_assignment.reactivation_decided` summary, then `tenant_assignment.restored` children sorted by immutable assignment ID; a zero-restoration decision has no child events. The summary and children are emitted only for assignments addressed by that command, and exactly one child exists per assignment whose persisted state changes. `occurredAt` or database insertion order never breaks ties and is not chain order.

Every command has a stable server-issued idempotency key, and each logical event has a deterministic event key unique within its partition, derived from command ID plus event purpose/target—not from mutable payload or wall-clock time. A retry first resolves the existing command result/events: if already committed it returns that result without allocating sequence numbers or appending duplicates; if the prior transaction rolled back it may execute normally; reuse with a different command fingerprint is rejected and security-signaled. Deadlock/serialization retries rerun the whole transaction after rollback and therefore cannot leave sequence gaps. Activation callbacks, outbox consumers, and batch children follow the same rule. Sequence numbers are never preallocated outside the transaction, and an event insert conflict rolls back the mutation and head update.

Chain heads are periodically signed or anchored in a separately administered append-only/WORM-capable store. A scheduled verifier checks partition sequence continuity, canonical hashes, signatures/anchors, idempotency uniqueness, and retention actions. Verification failure pages Provider security and writes an integrity record outside the affected chain. Hash chaining is tamper-evident, not a substitute for database access control, encrypted transport/storage, backups, monitoring, or separation of duties.

Audit data is included in encrypted backups and tested restoration. Access to audit storage and exports is logged. Application error handling never falls back to an unaudited successful mutation.

### Transactionality and failure semantics

Role, permission-set, assignment, account-state, and School Admin mutations lock/revalidate the authoritative records, apply optimistic versions, and insert all required audit events in the same database transaction. Bulk assignment writes its summary and all per-user child events in that transaction. If any mutation, child event, integrity field, or audit insert fails, all changes roll back and the caller receives a generic retryable failure; the audit failure is emitted through an independent restricted operational channel because the failed database transaction cannot attest to itself.

Denials and failed validation do not belong in the rolled-back mutation transaction. They are emitted after the decision through bounded security telemetry. Telemetry failure never changes a denial into success, and a telemetry outage raises an operational alert. For a future cross-store School Admin workflow, use an idempotent outbox committed with the authoritative mutation; do not claim atomicity across stores or publish an event before commit.

### Recovery and lockout support

Tenant RBAC recovery never grants a custom role automatically and never derives authority from Profil Guru, Profil Staf, role names, old audit snapshots, or suspended assignments. Undo is an explicit new forward action against current authoritative state and current Permission Tenant registry; it creates a new event linked by `reversesEventId` and never deletes or rewrites history.

A School Admin can recover an ordinary Akun Pengguna by explicitly selecting current valid active roles, including zero roles. The UI shows the prior event and computes a fresh current-state preview; stale role versions, archived/draft roles, removed or unknown permission keys, broken permission dependencies, inactive accounts, Tenant mismatch, or loss of the actor's authority block recovery. **Entitlement changes do not block role restoration and do not remove an otherwise valid former role from the selectable set.** Entitlement is evaluated only as a runtime availability gate: restored roles retain their permission composition, while entitlement-disabled permissions are shown as **Tidak tersedia untuk Tenant** and remain unusable until the entitlement is enabled. Sensitive/critical restoration and zero-role outcomes require confirmation and reason.

Tenant users cannot create, assign, replace, restore, or recover School Admin. A Tenant may have multiple active School Admins, as decided in issue 09; only Provider Admin may nominate, grant, disable, replace, or recover them. Before a Provider action that would leave a live Tenant with no usable School Admin, SIMAS blocks the action unless the locked transaction validates that at least one active, usable School Admin remains or commits `school_admin.replacement_cutover_completed` for a successor with `authorityState: none` and `proofState: completed`. Replacement disables only the selected incumbent and leaves other active School Admins unchanged. A successor requires an eligible Akun Pengguna bound to exactly that Tenant, current Provider authorization, completed proof/credential setup as applicable, mandatory reason, optimistic revalidation, and invalidation of the replaced Admin's active sessions/recovery tokens. Authority changes are observed on the next request.

If no usable School Admin remains because of legacy corruption or an interrupted external workflow, the Tenant is placed in a restricted recovery state: non-admin access continues only according to existing valid permissions, but Tenant RBAC mutations are frozen. Provider Admin opens a `recoveryCaseId`, verifies the school through an out-of-band support procedure, records evidence references rather than evidence secrets, and atomically appoints or reactivates enough eligible School Admins to restore the invariant of **at least one** active, usable School Admin, or cancels the case. Recovery does not impose a maximum: additional School Admins may subsequently be created through the normal Provider workflow. Starting recovery alone grants no access. Recovery completion invalidates old sessions and one-time credentials as appropriate, records the full before/after active-admin set and counts, and alerts the affected school contacts through a non-secret channel.

No shared emergency account, hard-coded bypass, direct database edit, audit replay, or self-service Tenant escalation is an approved recovery mechanism. Any future emergency access must be time-bounded, Provider-only, case-linked, separately alerted, incapable of suppressing audit, and explicitly ended.

### Evidence and fit with the repository

This policy extends rather than replaces established patterns:

- issue 04 already requires stable role identity, name snapshots, optimistic versions, reasons, permission diffs, and affected-assignment counts;
- issue 05 already requires atomic complete-set and bounded bulk assignment, per-user events joined by `batchId`, suspended assignments, explicit restoration, and reasons for high-impact changes;
- issue 06 already fixes server-derived actors/state, structured internal denial reasons, non-enumerating responses, next-request freshness, in-transaction revalidation, and mutation-plus-audit atomicity;
- issue 09 normatively defines the School Admin `authorityState`/`proofState` axes, canonical lifecycle events, multiple-current/former-admin roster, and the invariant that every active Tenant retains at least one active, usable School Admin;
- issue 14 normatively defines non-admin account lifecycle and restoration eligibility, including that entitlement affects runtime availability but does not block restoration of an otherwise valid Role Tenant;
- `lib/academic/academic-year.ts`, `lib/academic/class-group.ts`, and `lib/academic/class-membership.ts` append actor/time/reason/version or relationship events inside Tenant-scoped store transactions;
- `lib/academic/class-group-data.ts` and `lib/academic/class-membership-data.ts` enforce Tenant-scoped writes and insert history/events through the same database transaction;
- `lib/master-data/headmaster-assignment.ts` models assignment replacement with actor, previous assignment, effective date, reason, and occurrence time;
- `lib/master-data/school-person-master-data.ts` demonstrates explicit before/after handling for sensitive audit fields, reinforcing the need to minimize and redact such snapshots;
- the Provider audit-log page is currently an empty state, so the repository does not yet provide a unified retention, denial, tamper-evidence, or visibility implementation to inherit.

The resulting recommendation deliberately keeps authorization state separate from audit evidence, preserves the Provider/Tenant identity boundary in ADR 0001, uses the glossary's Akun Pengguna, Role Tenant, Permission Tenant, Template Role Tenant, School Admin, and Provider Admin terms, and closes the operational gaps without making audit logs a replayable privilege source.
