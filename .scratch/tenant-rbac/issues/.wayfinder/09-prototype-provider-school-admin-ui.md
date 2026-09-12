# Prototype the Provider School Admin UI

Type: prototype
Status: resolved
Blocked by: 02

## Question

What Provider UI safely supports viewing, creating, replacing, disabling, and recovering each Tenant's School Admin accounts while explaining consequences, requiring reasons, preventing unmanaged Tenants, and exposing audit history?

## Answer

### Recommendation

Replace the current single **School Admin pertama** card with a Provider-only **School Admin** workspace inside each Tenant detail page. Use a roster plus a focused account drawer, not independent destructive buttons. The roster shows every current and former School Admin with canonical `authorityState` (`none`, `active`, or `disabled`, rendered as **Belum berwenang**, **Aktif**, or **Disabled**) plus separate `proofState` (`pending`, `completed`, `expired`, or `cancelled`), name, email, last successful authentication, credential-recovery state, and latest lifecycle change. A persistent coverage banner states how many active School Admins can currently manage the Tenant; it becomes a blocking alert when a proposed action would leave none.

The workspace has three tabs:

1. **Akun** — roster, account details, and the permitted next action;
2. **Serah terima** — staged create/replace cases and their progress;
3. **Riwayat audit** — immutable lifecycle events, searchable by account, action, actor, date, and case ID.

The UI is an explanation and confirmation surface only. Provider authorization, Tenant/account eligibility, current status, coverage, and consequences are recomputed by the server on submission. Tenant users cannot reach or invoke these operations, and Provider Admin does not become a Tenant principal by managing them.

### Lifecycle and safe workflows

Treat Provider-owned School Admin authority as a versioned lifecycle record distinct from editable Tenant roles, credentials, and proof that a person controls an account. Credential setup or successful account-control proof never grants School Admin authority by itself. A pending nominee has zero School Admin authority, grants no Tenant access, and does not count as coverage. A disabled record grants no access but remains visible and recoverable. Do not hard-delete lifecycle records.

Cardinality is `1..n` active School Admin authorities for every active Tenant: multiple active School Admins are permitted, while fewer than one is forbidden. Creating an additional admin does not replace or weaken existing admins; replacement disables exactly the selected incumbent only after the successor is safely granted authority.

#### Canonical states, transitions, and events

Use two independent state dimensions; never collapse proof into authority:

- `authorityState`: `none | active | disabled`. Only `active` grants effective School Admin authority or counts toward Tenant coverage. `none` means authority has never been granted. `disabled` is the only canonical term/state for authority that was granted and later removed; do not use `inactive`, `deactivated`, `suspended`, or `revoked` as equivalent authority states.
- `proofState`: `pending | completed | expired | cancelled`. This records account-control proof for a nomination or recovery case. `completed` proves control of the credentialed account only and never changes `authorityState` by itself.

| Transition | State change | Changes authority? | Canonical event |
| --- | --- | --- | --- |
| Nomination created | new nomination with `authorityState: none`, `proofState: pending` | No | `school_admin.nomination_created` |
| Account-control proof completed | nomination `proofState: pending → completed`; authority remains `none` | No | `school_admin.account_control_proof_completed` |
| Authority granted | `authorityState: none → active` after completed proof and Provider confirmation | **Yes: grants** | `school_admin.authority_granted` |
| Authority disabled | `authorityState: active → disabled` | **Yes: removes** | `school_admin.authority_disabled` |
| Replacement cutover | successor `none → active` and selected incumbent `active → disabled` in one transaction | **Yes: grants and removes atomically** | `school_admin.replacement_cutover_completed` |
| Recovery proof completed | recovery `proofState: pending → completed`; authority remains `disabled` | No | `school_admin.recovery_proof_completed` |
| Authority reactivated | `authorityState: disabled → active` after completed recovery proof and Provider confirmation | **Yes: grants again** | `school_admin.authority_reactivated` |

Expired or cancelled proof closes that proof attempt without changing authority; retry creates a new versioned proof attempt rather than rewriting history. Credential rotation and session/token revocation are security side effects, not authority states. A replacement cutover additionally writes linked `school_admin.authority_granted` and `school_admin.authority_disabled` events for the two account aggregates; all three events share one case/correlation ID and commit atomically.

#### View

- Default to `active` authorities and pending nominations; allow **Tampilkan yang disabled**.
- Show `authorityState` separately from email verification, `proofState`, password-recovery, and session state so an operator cannot mistake a usable credential for active School Admin authority.
- Show the Tenant's identity (`name`, NPSN, canonical domain, immutable Tenant ID) in the page header and repeat it in every confirmation dialog.
- For each account show the safe next action only. Never derive action eligibility in the browser from displayed status.
- Show other active School Admins and the post-action active count in every mutating preview.

#### Create an additional School Admin

1. Provider selects **Tambah School Admin**, enters name and email, and gives a required operational reason.
2. Preview states that the nominee has zero authority, that account-control proof does not itself grant authority, whether a one-time proof path will be issued, and that existing School Admins remain active.
3. On confirmation, the server reauthorizes the Provider, resolves the target email/account without trusting a browser-supplied user or Tenant ID, and rejects identities already bound to another Tenant, Provider Admin, applicant, or otherwise ineligible. The response must not reveal another Tenant's identity.
4. Create a nomination with `authorityState: none`, `proofState: pending`, emit `school_admin.nomination_created`, and issue a single-use, expiring account-control proof mechanism. Store only its hash; display a generated secret at most once. Sending and retrying delivery must be idempotent.
5. Successful proof and credential setup move only `proofState: pending → completed` and emit `school_admin.account_control_proof_completed`; `authorityState` remains `none`.
6. Provider reviews the verified nominee and explicitly completes the grant. In a Provider-reauthenticated locked transaction, reauthorize, revalidate eligibility and versions, move `authorityState: none → active`, emit `school_admin.authority_granted`, revoke obsolete proof material and sessions as appropriate, validate that coverage remains at least one, and audit the transition. Existing admins are unaffected.

Do not silently move or promote an existing account based only on matching email. An eligible account already belonging to the same Tenant may be selected only after an explicit server-resolved preview; cross-context identities require a separate adjudication rather than automatic rebinding.

#### Replace a School Admin

Replacement is a staged handover case, not `disable old` followed by `create new`:

1. Select the incumbent, enter the successor, and require a reason.
2. Show an impact preview: incumbent identity, successor identity, current active-admin count, sessions to be revoked at cutover, account-control proof delivery, and the fact that the incumbent remains `active` until cutover.
3. Create the successor nomination with `authorityState: none`, `proofState: pending`, emit `school_admin.nomination_created`, and issue a single-use account-control proof/credential-setup path. A pending successor grants no authority or Tenant access and cannot satisfy the minimum-admin invariant.
4. Successful account-control proof moves only `proofState: pending → completed` and emits `school_admin.account_control_proof_completed`. The successor's `authorityState` remains `none`; coverage and the incumbent remain unchanged.
5. Only after proof succeeds, show **Selesaikan serah terima**. Reauthenticate the Provider for this high-impact step and require explicit confirmation of both account emails and the Tenant domain.
6. In one locked transaction, reauthorize the Provider, lock the Tenant roster and both lifecycle/account records, revalidate eligibility and versions, atomically move the successor `authorityState: none → active` and the selected incumbent `authorityState: active → disabled`, revoke the incumbent's sessions and outstanding proof/recovery tokens, validate that at least one active School Admin remains, preserve unrelated Tenant roles/profile links as data without allowing them to confer School Admin access, and emit linked `school_admin.authority_granted`, `school_admin.authority_disabled`, and `school_admin.replacement_cutover_completed` events under one case ID. No authority change occurs before this transaction commits, and all changes fail together.

If account-control proof expires or the case is cancelled, the incumbent remains active and the nominee retains zero School Admin authority or is cancelled. There is never an unmanaged interval. Multiple active School Admins are permitted; completing a replacement disables only the selected incumbent, while every other active admin remains unchanged.

#### Disable

- **Non-emergency disable** requires a reason and an impact preview. It is blocked when the target is the last active School Admin, regardless of what the stale page showed.
- Confirmation identifies the account and Tenant, states that all sessions and outstanding proof/password-recovery material will be revoked, and states that authority becomes `disabled` and access ends on the next request.
- The atomic mutation locks the Tenant's School Admin roster, rechecks Provider authority and target version, verifies another active School Admin remains, moves `authorityState: active → disabled`, emits `school_admin.authority_disabled`, revokes sessions/tokens, and writes audit.
- A pending nominee is not a substitute for another active admin. To remove the last incumbent, use replacement and complete the successor's authority grant first.

#### Recover

Expose two different actions because they have different security consequences:

- **Recover access for an active School Admin** repairs credentials without changing authority. Before first authentication, Provider may rotate a temporary credential; afterward, prefer a single-use expiring recovery link or the normal verified recovery channel. Rotation revokes old credentials/recovery tokens and all sessions. Never display an existing secret.
- **Reactivate a `disabled` School Admin** changes authority and therefore requires a reason, eligibility check, Provider reauthentication, and a consequence preview. Recovery starts with `authorityState: disabled`, `proofState: pending`; it does not silently restore authority or sessions. Successful proof moves only `proofState: pending → completed` and emits `school_admin.recovery_proof_completed`, while authority remains `disabled`. A separate Provider-reauthenticated locked transaction moves `authorityState: disabled → active` and emits `school_admin.authority_reactivated`. If the old identity is unsafe or unavailable, use replacement instead.

A recovery attempt must not bypass current Tenant binding, account eligibility, or lifecycle version checks. Generic browser errors should not disclose whether an email belongs to another Tenant or privileged context.

### Unmanaged-Tenant invariant

For every active Tenant, committed cardinality is `1..n`: one or more active, usable Provider-owned School Admin authorities. Multiple active School Admins are explicitly permitted; zero is forbidden. Enforce the minimum as a server/domain invariant, not a disabled button:

- nominations with `authorityState: none`, any expired/cancelled proof, and records with `authorityState: disabled` do not count;
- disable and replacement cutover lock the Tenant roster and evaluate coverage inside the mutation transaction;
- concurrent operations cannot each observe the same incumbent and both remove coverage;
- Tenant suspension/closure may make accounts unusable because of Tenant operational policy, but must not silently delete School Admin authority or its history;
- imported legacy data with zero or ambiguous admins enters a Provider reconciliation queue and remains blocked from ordinary lifecycle mutation until resolved; do not hide it through inner joins or invent an admin automatically.

The Tenant list should expose coverage states such as **Terkelola**, **Bukti akun tertunda**, and **Perlu rekonsiliasi**, with a Provider alert/filter for any invariant violation.

### Reasons, consequences, and confirmation

Require a normalized, length-limited reason for create, replace, disable, reactivation, cancellation, resend/rotation, and emergency recovery. Explain that reasons become audit records, forbid credentials or secrets in the field, render them as escaped text, and reject empty/whitespace-only or oversized values server-side.

Every preview must show authoritative consequences in plain Indonesian:

- who gains or loses School Admin authority;
- whether account-control proof is pending and whether a separate Provider authority grant/reactivation is still required;
- sessions, credentials, and recovery links that will be revoked;
- post-action active-admin count and whether the Tenant remains managed;
- that access changes are observed on the next request;
- whether the operation can be reversed and which recovery path applies.

Use a typed confirmation sentence only for replacement cutover, last-sensitive reactivation, or other emergency/high-impact recovery; ordinary create should not be made error-prone with ceremonial typing. Never ask an operator to paste a password, temporary credential, or token as confirmation.

### Audit contract

Write audit in the same transaction as every lifecycle transition. Canonical `eventName` is exactly one of `school_admin.nomination_created`, `school_admin.account_control_proof_completed`, `school_admin.authority_granted`, `school_admin.authority_disabled`, `school_admin.replacement_cutover_completed`, `school_admin.recovery_proof_completed`, or `school_admin.authority_reactivated`; UI labels may be localized, but stored names and meanings must not vary. Credential-only events use a separate credential namespace and never imply an authority change.

Each lifecycle event records immutable event ID, event name, case/correlation ID, Tenant ID and identity snapshot, target authority/account ID and safe name/email snapshot, `authorityState` and `proofState` before/after, lifecycle versions, Provider actor ID and identity snapshot where a Provider decision occurs, timestamp, normalized reason, active-admin count before/after, session/token revocation counts, and outcome. Proof-completion events explicitly retain unchanged authority state/count; authority-changing events explicitly record the coverage delta.

Replacement links the earlier `school_admin.nomination_created` and `school_admin.account_control_proof_completed` events to one locked cutover that atomically writes `school_admin.authority_granted` for the successor, `school_admin.authority_disabled` for the incumbent, and `school_admin.replacement_cutover_completed` for the case. Recovery links `school_admin.recovery_proof_completed` to the later Provider-confirmed `school_admin.authority_reactivated`; proof completion alone leaves authority `disabled`.

Record failed high-impact attempts and stale/conflict denials in a security event stream without storing submitted secrets. The Provider audit UI shows sanitized metadata and reason text, never password hashes, temporary credentials, reset tokens, session tokens, or raw sensitive request bodies. Audit access is Provider-only and independently server-authorized.

### Concurrency and server enforcement

- Give every School Admin lifecycle record and handover case an optimistic version. Forms submit opaque record/case IDs plus the version shown, never authoritative Tenant IDs, actor IDs, statuses, counts, or diffs.
- On submit, resolve all identities server-side, reauthorize Provider access, lock the Tenant and relevant authority/account rows in a deterministic order, recheck versions and the unmanaged-Tenant invariant, perform mutation plus revocations plus audit atomically, then revalidate Provider views.
- Stale writes return a specific conflict state: **Data berubah sejak halaman dibuka. Muat ulang untuk meninjau kondisi terbaru.** Do not auto-retry a destructive transition against changed state.
- Commands use idempotency/case keys so double submission, network retry, and activation callbacks cannot duplicate authorities, delivery, or audit transitions.
- State-changing requests retain framework CSRF protections and should validate origin/fetch metadata where supported. Authorization is checked before parsing or acting on sensitive target input.

### Loading, accessibility, and error states

- Initial roster and audit fetches use labelled skeletons or a visible **Memuat…** status; filters retain prior results with `aria-busy` while refreshing. Empty states distinguish **Belum ada riwayat**, **Tidak ada hasil**, and **Data gagal dimuat**.
- Every async action disables only its form, prevents duplicate submission, shows a spinner plus action-specific text such as **Membuat undangan…** or **Menyelesaikan serah terima…**, and preserves entered reason on recoverable validation errors. Do not leave the whole page inert.
- Dialogs have a programmatic title/description, trapped focus, Escape support before submission, and returned focus after close. Every destructive dialog initially focuses its heading or consequence-summary region (made programmatically focusable), with the safe cancel/back action next in keyboard order and the destructive confirmation after it. Never place initial focus on either action. Destructive actions are not distinguished by color alone.
- Status badges include text; tables have proper headers/captions and a card/list alternative at narrow widths. Menus and icon buttons have accessible names. Progress steps use an ordered list with the current step announced.
- Inline validation associates messages with fields using `aria-describedby`; submission summaries and server failures use `role="alert"`, while success/progress uses a polite live region. Move focus to the error summary after failure and to the success heading after completion.
- Distinguish validation, authorization, not-found/non-enumerating, stale conflict, invariant-blocked, delivery failure, and unexpected errors. A delivery failure after a committed pending record must say the account still has no access and offer a safe idempotent resend; it must not roll back into an ambiguous active state.
- On `401/403`, stop and present the appropriate login/forbidden state. On target mismatch or cross-context identity, use a generic ineligible/not-found result. Unexpected errors retain a correlation ID for support and do not expose stack traces or sensitive identity state.

### Prototype verdict and implementation boundary

The safe interaction model is **roster + staged handover + audit timeline**. A one-step destructive modal is insufficient because account-control proof, the separate Provider-owned authority grant, coverage, session revocation, and concurrent Provider actions cannot be safely represented as one client-side decision. This answer specifies the UI/state contract only; it does not authorize production implementation or prescribe final table/component names.

### Inspected evidence

- `monorepo/app/(provider)/provider/tenants/[tenantId]/page.tsx` renders one **School Admin pertama**, its identity/temporary-credential state, and no roster, disable, replacement, or audit workflow.
- `monorepo/lib/provider/provider-tenant-data.ts` inner-joins `tenant` to singular-role users and limits detail to one row; this can omit unmanaged Tenants from Provider views and cannot represent multiple/current/former admins.
- `monorepo/app/(provider)/provider/tenants/[tenantId]/reset-credential-form.tsx` already supplies pending text, disables duplicate submit, uses status/alert semantics, explains session/credential revocation, and displays a replacement secret once.
- `monorepo/lib/tenancy/temporary-credential-activation.ts` locks activation state, limits temporary reset to pre-first-authentication, hashes the replacement, revokes all sessions, and reissues atomically.
- `monorepo/app/(provider)/provider/tenants/applications/[applicationId]/approval-form.tsx`, `monorepo/app/(provider)/provider/tenants/applications/actions.ts`, and `monorepo/lib/provider/provider-applications.ts` show the existing Provider-authorized, loading-aware approval flow and explicit concurrency/conflict result.
- `monorepo/lib/provider/provider-application-data.ts` atomically locks the applicant/account/session context, promotes the existing applicant to the initial School Admin, revokes sessions, finalizes approval, and writes an outbox event.
- `monorepo/lib/provider/provider-access.ts` confirms Provider access is a separate persisted identity context and that Provider actions/data are server-authorized.
- `monorepo/app/(provider)/provider/audit-log/page.tsx` is currently only an empty state, so lifecycle audit presentation and storage remain specification work rather than an existing capability.
- Issue 02 establishes that School Admin assumptions span provisioning, activation, Provider queries, central routing, and UI; issues 01, 04, 05, and 06 establish Provider ownership, non-Tenant-editable School Admin authority, next-request revocation, optimistic concurrency, fail-closed server enforcement, and atomic audit expectations.
