# Design the server authorization interface

Type: grilling
Status: resolved
Blocked by: 02, 03

## Question

What single server-owned authorization interface should resolve effective permissions, enforce Tenant isolation, fail closed across pages and mutations, produce consistent denial reasons, and observe grant changes on the next request?

## Answer

Tenant authorization uses one centralized, server-only evaluator shared by pages, server actions, route handlers, downloads, and mutations. Domain-specific wrappers may provide typed convenience interfaces, but they must delegate to this evaluator and must not introduce independent security semantics.

### Authoritative principal and freshness

- The authenticated session establishes only the current `userId`; session fields, cookies, JWT claims, client state, and navigation state are not authorization sources.
- On every protected request, the server reads the persisted account state, exact Tenant membership, Provider-owned School Admin authority or active Role Tenant assignments, active role permissions, Tenant operational state, and relevant feature entitlement.
- Effective permissions are the deduplicated union of valid permissions from active assignments. Draft or archived roles, suspended assignments, malformed or unknown permission keys, and invalid state grant nothing.
- Request-local memoization is allowed. Cross-request permission caching is not part of the initial design, so a grant or revocation is observed on the next request without requiring logout.
- Role IDs may accompany the principal for explainability and audit, but runtime authorization checks permission keys rather than role names.

### Evaluation order

The evaluator applies the following fail-closed sequence:

1. Require a valid authenticated session.
2. Load the persisted user and require an active account.
3. Resolve the requested domain to a Tenant.
4. Require the persisted user to belong to exactly that Tenant.
5. Reject Provider Admin, Applicant, and other non-Tenant identities from the Tenant authorization context.
6. Require completed account activation and credential state where applicable.
7. Apply Tenant operational restrictions, including read-only operation.
8. Require the relevant Tenant feature entitlement when the capability belongs to an entitled feature.
9. Require a known, valid permission key from the code-owned registry.
10. Require the principal's effective permission set to contain that key.
11. Apply the typed contextual data policy for the requested record or collection.
12. Apply domain invariants and optimistic-concurrency checks before mutation commit.

Permission, entitlement, and contextual scope are independent gates. Passing one never implies passing another.

### Interface shape

The implementation should expose a small server-owned facade conceptually equivalent to:

```ts
requireTenantPermission({
  domain,
  permission,
})
```

For contextual records, typed domain authorizers conceptually extend it:

```ts
requireTenantRecordAccess({
  domain,
  permission,
  resource: { type, id },
})
```

Every protected entry point must call this facade directly or through a wrapper that delegates to it. Authenticated route groups, hidden navigation, disabled controls, and client-side state are never sufficient enforcement.

### Denial contract

External responses disclose only what the caller is entitled to know:

- Missing authentication redirects pages to login and returns `401` for applicable APIs.
- Unknown domains, Tenant mismatch, cross-Tenant record IDs, and contextual record-scope denial return `404` to prevent enumeration.
- A caller in the correct Tenant who lacks a required permission receives `403`.
- Disabled entitlement and Tenant read-only restrictions receive `403` with an appropriate general user-facing state.
- Unknown or invalid permission keys fail closed with `403` and an internal configuration/security signal.

The server may retain structured internal denial reasons such as `no-session`, `tenant-mismatch`, `account-inactive`, `entitlement-disabled`, `unknown-permission`, `permission-denied`, and `scope-denied`. It must not expose cross-Tenant existence, role composition, or detailed identity state to the browser.

### Sensitive mutations

For role, permission, assignment, account-lifecycle, bulk, and other security-sensitive mutations:

- Treat previews as explanatory only and recompute all authoritative state on submission.
- Revalidate the actor, verified Tenant, target eligibility, account state, role state and version, permission registry, assignment version, and every bulk target.
- Never accept browser-provided `actorUserId`, authoritative `tenantId`, before-state, or permission diff as fact.
- Commit the mutation and its audit event in the same transaction.
- Apply bulk operations atomically; if any target is stale or invalid, apply no changes.
- Recheck authority inside the transaction before committing especially sensitive mutations. Ordinary business requests may rely on the request's resolved principal; an already-running request is not retroactively cancelled when a grant changes concurrently.

### School Admin boundary

School Admin authority is a Provider-owned system status, not a Tenant-owned custom role. The resolver recognizes it from persisted Provider-managed authority and resolves its system policy without consulting a Tenant-editable role row. Tenant role names cannot confer School Admin authority, and misleading variants must not bypass reserved-name validation. Provider Admin remains a separate security context and does not automatically become a Tenant principal.

### Initial implementation constraints

The initial release deliberately avoids cross-request authorization caches, permission-bearing JWTs, and a generic authorization DSL. Direct indexed database reads, request-local memoization, a centralized evaluator, and typed domain-specific contextual authorizers provide the simplest auditable design that satisfies immediate next-request enforcement.
