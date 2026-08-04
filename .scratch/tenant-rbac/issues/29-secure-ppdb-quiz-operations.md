# 29 — Secure PPDB and quiz operations

**What to build:** Enforce Permission Tenant independently from Provider feature entitlement for authenticated PPDB administration and Ulangan while preserving public and Applicant flows outside Tenant RBAC.

**Blocked by:** 18 — Introduce the centralized evaluator in shadow mode; 20 — Backfill legacy non-admin access without widening; 22 — Deliver multi-role assignment and effective access.

**Status:** in-progress

- [x] Every authenticated PPDB and quiz page, action, handler, document, result, export, and mutation uses its exact operation-map permission.
- [x] Read/write feature entitlement, Tenant state, exact permission, contextual policy, sensitive projection, and domain invariant are evaluated as independent gates.
- [x] Applicant and public PPDB operations preserve their existing separate identity and server-derived Tenant policies and do not acquire Tenant permissions.
- [ ] PPDB documents and result downloads use private Tenant-qualified lookup and explicit sensitive/download/export permissions.
- [x] Quiz teacher delegation remains denied unless a canonical complete teaching-assignment tuple exists; unrelated class and subject assignments cannot combine.
- [x] Disabled entitlement and missing same-Tenant permission return safe `403`, while foreign and concealed records follow the common `404` contract.
- [x] Navigation reflects both entitlement availability and effective permission without conflating the two or replacing server enforcement.
- [ ] Generated matrix, differential isolation, document security, HTTP, and browser tests cover authenticated and intentionally excluded surfaces.
