# Define the School Admin authorization boundary

Type: grilling
Status: resolved
Blocked by: none

## Question

What exact server-side and navigation authorization contract ensures only the School Admin of the current Tenant can read or mutate Master Data, including direct URL access, cross-Tenant identifiers, archived records, imports, and read-only Tenant lifecycle states?

## Answer

### Authorization predicate

Master Data access is granted only when all of the following are true:

- The user has a valid authenticated session.
- The session resolves to a Tenant whose current lifecycle state can be verified.
- The domain in the requested URL resolves to and matches that session Tenant.
- The account holds the `school-admin` role in that same Tenant.
- The requested operation is permitted by the Tenant's current lifecycle state.

A role held in another Tenant and a Guru, Staf, or other Warga Sekolah profile never confer School Admin authority. Authorization fails closed whenever identity, role, Tenant, domain, or lifecycle state is missing, stale, mismatched, or indeterminate.

### Denial behavior

- An unauthenticated user is redirected to login with the original destination retained.
- An authenticated request for an unknown Tenant/domain, a domain that does not match the session Tenant, an unknown record, or a record belonging to another Tenant receives `404 Not Found`.
- An authenticated member of the matching Tenant without the `school-admin` role receives `403 Forbidden`.
- An unknown or unverifiable Tenant lifecycle state denies all access.
- Responses never reveal whether a cross-Tenant identifier exists.

### Tenant isolation

Every list, detail, mutation, relationship, archive, reactivation, history, and import query is scoped by the authoritative `tenantId` derived from the validated session and domain. Record lookup uses both `recordId` and `tenantId`; a client-provided Tenant identifier is never trusted. Server code must not first fetch an unscoped record and authorize it afterward.

### Authorized operations

Within this effort, only the matching Tenant's `school-admin` may:

- Read Master Data lists, details, histories, and archived records.
- Create and edit records.
- Archive and reactivate records.
- Download people-import templates.
- Upload, validate, preview, confirm, and execute imports.
- Read import batches and per-row outcomes.

No other Tenant role has Master Data read access in this scope.

Archived records remain readable, including their histories and relationships, but cannot be edited or used in new relationships. Their only mutation is reactivation, which must pass current lifecycle, relationship, and uniqueness validation.

### Tenant lifecycle policy

- `Aktif`: full read and mutation access.
- Active trial: the same access as `Aktif`.
- Expired trial: read-only access plus template download; creating, editing, archiving, reactivating, and executing imports are denied.
- `Ditangguhkan`: read-only access; template download and all mutations are denied.
- `Ditutup`: no Tenant workspace or Master Data access.
- Unknown or unverifiable state: deny all access.

The server checks the current lifecycle state on every request. UI-disabled controls are not enforcement.

### Navigation and enforcement points

The Master Data menu and its nine entries are shown only when the current Tenant session has the `school-admin` role. This is navigation behavior only. Every page, server action, route handler, template download, upload, import stage, and background job independently enforces the server-side authorization predicate. Direct URL access receives no special trust.

Authorization uses current server-side role and Tenant state. A stale client state or cookie cannot preserve access after a role or Tenant lifecycle change.

### Import authorization

Authorization is checked independently when downloading a template, uploading a file, validating and previewing it, confirming execution, executing it, and reading its results. Every batch is permanently scoped to its `tenantId` and records its initiating actor.

Before execution, including execution by a background worker, the system revalidates that the batch belongs to the Tenant and that the Tenant still permits mutation. If the actor's School Admin authority has been revoked or the Tenant has become read-only, the batch is cancelled without importing rows.

### Provider-controlled fields

Profil Sekolah mutations use an allowlisted input schema. NPSN, domain, `tenantId`, Tenant lifecycle state, and other Provider-controlled attributes are excluded from that schema. Supplying a prohibited field makes the request invalid rather than being silently ignored. Displayed NPSN and domain values are read from the Provider-controlled Tenant source of truth.

### Audit and security events

Every successful Master Data mutation records the Tenant, actor, timestamp, operation, and affected record. Import audit records also retain batch/file identity and per-row outcomes.

Cross-Tenant attempts, unauthorized-role attempts, and mutations denied because a Tenant is read-only are recorded as security events without persisting sensitive request payloads. Routine expired sessions and ordinary not-found requests do not require permanent security-audit entries. User-facing errors remain generic and do not disclose cross-Tenant record existence.
