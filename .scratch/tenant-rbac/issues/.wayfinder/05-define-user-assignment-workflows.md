# Define user assignment workflows

Type: grilling
Status: resolved
Blocked by: 04

## Question

How do School Admins find eligible non-admin Tenant accounts, grant or revoke multiple roles, inspect effective access, handle accounts without roles, and avoid accidental lockout or privilege escalation?

## Answer

### Eligibility and discovery

Only an existing non-School-Admin Akun Pengguna bound to the actor's verified Tenant is eligible for Role Tenant assignment. Provider Admins, applicants, School Admins, accounts from another Tenant, and Warga Sekolah profiles without login accounts are never targets. Linking to a Warga Sekolah profile is optional and never grants a role automatically.

Inactive or suspended accounts remain visible for audit but cannot receive new assignments. The server resolves target `userId`, Tenant membership, account kind, and status from authoritative data; it never trusts a browser-supplied Tenant ID or email as identity. Search responses do not reveal whether an unmatched email exists in another Tenant.

The user directory is paginated and searched server-side by account name and email. Where linked, it may display and filter by Warga Sekolah identity and Profil Guru, Profil Staf, or Profil Siswa. Filters include current role, no role, account status, and linked profile kind. School Admin accounts are visible only where needed as Provider-managed context and are never editable through this workflow.

Creating/inviting and lifecycle-managing a non-admin account is a separate prerequisite from assigning roles. [Define the non-admin Tenant account lifecycle](./14-define-non-admin-account-lifecycle.md) owns that newly surfaced decision.

### Accounts without roles

A Tenant account may validly have zero active roles. It can authenticate but receives no business permission and lands on an **Akses belum diberikan** page containing only account information, school identity, password management, and sign-out. Dashboard, Tenant data, direct routes, and protected operations remain unavailable. School Admin can filter such accounts in the directory.

### Atomic multi-role assignment

The editor presents active custom roles as a multi-select. Save replaces the user's complete active assignment set atomically. The server revalidates every selected role as active, Tenant-owned, and assignable; School Admin is never an assignable role. Unchanged assignments persist, and one invalid/stale target fails the entire write.

Optimistic version checks prevent concurrent School Admin edits from overwriting each other. Before confirmation, UI shows roles and effective permissions gained/lost, sensitive or critical changes, and whether the account will end with zero roles. Changes apply on the user's next request.

The last role may be revoked. UI explicitly warns that the account will lose all business access, identifies the user, lists lost effective permissions, and requires a reason.

### Effective-access explanation

The account detail shows all assigned active roles and the deduplicated union of effective Permission Tenant entries. Every permission lists all source roles. Sensitive/critical permissions are marked.

A permission present in a role but unavailable because the Tenant lacks the corresponding entitlement is shown as **Tidak tersedia untuk Tenant**, not silently removed from role composition. Contextual domain limits such as assigned classes or units are explained as scope constraints rather than additional roles or deny rules.

### Bulk assignment

School Admin may add or revoke one active role across a bounded batch of eligible accounts (initial implementation target: at most 100). Preview distinguishes unchanged, changed, invalid, and zero-role outcomes and highlights sensitive access.

The batch is atomic: stale eligibility, role status, or assignment versions fail the whole operation. Audit retains per-user assignment events connected by one `batchId`. Bulk operations cannot target School Admin or activate inactive accounts.

### Inactive accounts

When an account is deactivated, its assignments become suspended rather than deleted. Suspended assignments grant no access and do not count as active role usage that blocks role archival. They remain visible for history.

Reactivation never silently restores access. School Admin must explicitly choose either valid former assignments or an account with no role. Draft, archived, removed, unknown, or otherwise invalid roles cannot be restored. Account reactivation and the assignment-restoration decision share an audit context.

### Timing, reasons, and combinations

Initial scope supports immediate assignment/revocation only; there are no scheduled start/end dates or worker-driven expiry.

A reason is mandatory for revocation, sensitive/critical grants, bulk operations, suspended-assignment restoration, and any result that leaves an account without roles. A standard single-user grant may omit a reason. Audit always records actor, target, timestamp, assignment diff, and batch context. Reasons are length-validated and must not contain credentials or secrets.

Role combinations are additive and have no generic mutual-exclusion engine. UI warns about redundant permissions, sensitive/critical unions, or combinations that appear inconsistent with linked profiles, but does not block them. A true domain invariant must be enforced by that domain rather than inferred from role names.
