# Define system and custom role lifecycle

Type: grilling
Status: resolved
Blocked by: 03

## Question

Which roles are immutable system roles, seeded templates, or Tenant-owned custom roles, and what copy, rename, edit, archive, delete, and assignment-impact rules govern each kind?

## Answer

### Role kinds

Tenant RBAC distinguishes three concepts:

1. **System role `School Admin`.** Provider-managed and not represented as a Tenant-editable custom role. Its effective access includes every available Tenant capability plus every `school-admin-only` permission. Tenant UI cannot rename, edit, copy, archive, delete, or assign it. Its account lifecycle remains exclusively Provider-owned.
2. **Template Role Tenant.** A versioned, code-defined recipe containing only `tenant-assignable` permissions. Initial templates are Pimpinan, Guru, Staf, Siswa, and Tamu. Templates grant no access and are not role records until a School Admin creates a Tenant role from one.
3. **Tenant-owned custom role.** A role with a stable identity scoped to exactly one Tenant. It may originate from a template or from scratch; after creation it evolves independently.

A new Tenant receives only the system School Admin. Onboarding may offer templates that create draft roles, but no non-admin role becomes active or assigned automatically. A person's Profil Guru, Profil Staf, or other domain profile never creates a role assignment.

### Identity and naming

Every custom role has an immutable ID. Rename changes display identity only; permissions and assignments remain attached to the same ID.

Names are required and unique within a Tenant after trimming, whitespace normalization, and case-insensitive comparison. Equivalent spellings such as `Staf Perpustakaan` and `staf  perpustakaan` conflict. Other Tenants may reuse the name. System/template names and misleading variants of `School Admin` are reserved. Archived roles retain their names, preventing ambiguous reuse unless the old role is first renamed.

Active roles may be renamed. Audit records carry both role ID and the name snapshot at the time of the event so historical meaning survives later renames.

### Lifecycle

Custom role status is one of:

- `draft`: may have zero permissions and cannot be assigned;
- `active`: has at least one valid `tenant-assignable` permission and may be assigned;
- `archived`: cannot be assigned and grants no effective access.

Allowed transitions are `draft → active`, `draft → archived`, `active → draft`, `active → archived`, and `archived → draft`. There is no direct `archived → active` transition.

Activation validates every key, dependency, assignment classification, and risk confirmation against the current registry. An active role may move to draft or archive only after all active user assignments are removed or migrated. Archiving never silently revokes a group of users. Restore always produces an unassigned draft; it reuses the original ID and history but restores no former assignments. Unknown, removed, or deprecated permissions must be corrected or migrated before the role can activate again.

There is no Tenant-facing hard delete. Archive preserves identity, references, versions, and audit history. Any eventual physical retention process is internal system policy rather than a School Admin action. School Admin and templates cannot be archived or deleted by Tenant users.

### Editing and assignment impact

Editing an active role updates effective access for every current holder on the next request. Before confirmation, UI shows affected-user count and the exact permissions added or removed. Sensitive or critical additions require explicit confirmation.

Role updates and lifecycle transitions use optimistic version checks. Stale writes fail rather than overwrite concurrent changes. Audit captures actor, reason, timestamp, role/version before and after, permission diff, and affected-assignment count. Permissions are not snapshotted onto each user; the current active role remains the authority.

### Copying

An active custom role or Template Role Tenant may be copied. School Admin cannot be copied. The result has a new ID and required unique name, copies only `tenant-assignable` permissions, and starts as a draft. It does not copy user assignments, audit history, archive state, or system metadata. Provenance records `copiedFromRoleId` or `templateKey`/`templateVersion`, but the copy is never synchronized with its source.

### Template evolution

Templates have stable keys and versions in the code registry. Roles created from templates retain provenance, but deployment changes never mutate them automatically. UI may compare a role to a newer template and offer an explicit update with permission-impact preview; accepting it is an ordinary versioned, audited role edit.

Deprecated templates cannot create new roles and may point to replacements. Existing roles derived from them remain active and unchanged.
