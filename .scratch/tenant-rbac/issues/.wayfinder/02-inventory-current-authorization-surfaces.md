# Inventory current authorization surfaces

Type: task
Status: resolved
Blocked by: none

## Question

What authentication, session, Tenant membership, `tenant_role`, Provider Admin, route, server-action, API, navigation, and mutation patterns currently exist, and where are authorization checks absent or inconsistent?

## Answer

### Identity, session, and persistence

- Better Auth uses the Drizzle/MySQL adapter in `monorepo/lib/platform/auth.ts`. Sessions are database rows keyed to `user.id`; `tenantId` and singular `tenantRole` are exposed as non-input session fields.
- `monorepo/db/schema.ts` stores Tenant membership directly on `user.tenantId` and one nullable enum `user.tenantRole` (`school-admin`, `pimpinan`, `staff`, `guru`, `siswa`, `guest`). There are no role, permission, or user-role join tables.
- Provider identity is separate: membership in `provider_admin` plus `user.tenantId IS NULL`. Applicant identity is another separate table.
- `getCentralIdentity` re-queries persisted identity state and classifies a user as Provider Admin, applicant, or Tenant member. Tenant membership currently carries exactly one role.
- School Admin provisioning, Provider Tenant lists/details, applicant promotion, and temporary-credential activation all query `tenantRole === "school-admin"`; migration therefore reaches beyond authorization checks into lifecycle and reporting queries.
- Whether Better Auth internally caches additional user fields long enough to affect next-request revocation is not established by this inventory and remains a later architecture decision.

### Tenant boundary and page access

- `enforceTenantPageAccess` resolves the requested domain, reads the authenticated central identity, verifies exact Tenant membership, and enforces temporary-credential activation. Cross-Tenant access redirects or returns not-found for protected master-data paths.
- The authenticated Tenant layout calls that guard and requires any recognized legacy `TenantRole`; it does not authorize individual pages or operations.
- The layout and proxy routing are context/routing boundaries, not sufficient authorization boundaries for directly callable server actions and route handlers.
- `requireTenantFeatureAccess` verifies session, requested Tenant, and an activated Tenant principal. Despite its name, it accepts no feature key. Its activation store currently accepts only `school-admin`, but that coupling is implicit and unsuitable as a future permission check.

### Existing authorization policies

- The strongest Tenant policy is `enforceMasterDataAccess` backed by `authorizeMasterDataAccess`. It verifies session user, exact Tenant/domain binding, operational/trial state, Provider feature policy, and requires the singular role `school-admin`.
- Its principal is structurally fixed to `role: "school-admin"` and offers only broad `read`, `write`, and `downloadTemplate` capabilities plus import operation variants.
- Record access and most stores preserve Tenant isolation by carrying the verified principal/`tenantId` and comparing record `tenantId`. This is a useful defense-in-depth pattern for RBAC.
- `enforceTenantFeatureAccess` adds named Provider-controlled feature checks but still inherits the School Admin-only master-data policy. Tenant entitlement and user permission are therefore conflated.
- `tenantProtectedAction` composes Tenant activation with trial writability but has no explicit operation permission.

### Server actions and route handlers

- There are 26 server-action modules: 19 authenticated Tenant modules, 3 Provider modules, 2 applicant/auth modules, and 2 public PPDB modules.
- Of the 19 authenticated Tenant modules, 16 use `enforceMasterDataAccess`, 2 use named `enforceTenantFeatureAccess` (PPDB and Ulangan), and the dashboard module uses `requireTenantFeatureAccess`/`tenantProtectedAction`.
- There are 8 route handlers: 6 authenticated Tenant handlers (3 master-data guards and 3 named feature guards), Better Auth's generated handler, and public registration.
- The public PPDB and applicant paths are intentionally outside Tenant RBAC and derive their Tenant/user scope server-side.
- Provider actions consistently call `requireProviderActionAccess`; Provider authorization is binary and intentionally remains outside this Tenant RBAC destination.

### Navigation and UI

- `TenantNavMenu` filters static menu items client-side by the singular role or `"*"`. This is presentation only and cannot enforce access.
- Master Data, Tenant settings, integrations, and PPDB administration are statically marked School Admin-only. Many dashboard, attendance, library, correspondence, scheduling, quiz, and user-management entries use `"*"`.
- `/users` is available to every recognized Tenant role and lists all Tenant users, email addresses, verification states, and singular roles after only membership enforcement. Its future access requires an explicit user-directory permission decision.
- The dashboard contains direct `tenantRole === "school-admin"` rendering checks. `DashboardHeader` also contains local role-switching demonstration state unrelated to the authenticated principal, which must not become an authorization source.
- Feature filtering and role filtering are parallel UI concepts today; the RBAC design must keep entitlement availability separate from effective user permission.

### Inconsistencies and migration risks

1. Current Tenant authorization is safe against common cross-Tenant access on the reviewed principal-based paths, but it is effectively School Admin versus everyone else rather than granular RBAC.
2. Feature entitlements, operational/trial writability, activation, legacy roles, and user permissions are represented by overlapping guards with deceptively similar names.
3. Most business operations collapse into broad master-data `read`/`write`; create, edit, archive, lifecycle transitions, assignments, import validation/execution, downloads, PPDB, quiz, and settings need explicit mapping rather than one-for-one migration.
4. Landing-page settings reuse the master-data write guard, an example of authorization coupled to the wrong domain.
5. Dashboard onboarding and generic protected actions do not name the capability being authorized; they rely on the current activation implementation accepting only School Admin.
6. Import downloads use both master-data operation names and feature keys for equivalent behavior.
7. Page/layout guards, menu visibility, and feature availability must never substitute for operation-level server authorization.
8. Existing School Admin assumptions appear in provisioning, activation, Provider queries, central routing, tests, and UI—not only in `tenant_role` storage.

### Consequence for the map

The current surfaces can now be enumerated against a future permission vocabulary. [Map current operations to permissions](./13-map-current-operations-to-permissions.md) captures that newly specifiable task and is blocked by the permission-language and contextual-boundary decisions.
