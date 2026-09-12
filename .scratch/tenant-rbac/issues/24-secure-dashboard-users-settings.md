# 24 — Secure dashboard, user directory, and Tenant settings

**What to build:** Replace broad or presentation-only authorization for the dashboard, user directory, school profile, Tenant settings, and integrations with exact Permission Tenant checks and server-side field projections.

**Blocked by:** 18 — Introduce the centralized evaluator in shadow mode; 20 — Backfill legacy non-admin access without widening; 22 — Deliver multi-role assignment and effective access.

**Status:** resolved

**Implementation:** Completed in commit `2ab3935` with server-side authorization enforcement for the dashboard, user directory, and Tenant settings, including direct-route protection.

- [x] Every covered page load, server action, route handler, and navigation item delegates to the centralized evaluator with its exact operation-map key.
- [x] Dashboard and user-directory behavior preserves the approved frozen legacy equivalence while allowing future exact custom-role grants.
- [x] Ordinary user view, contact fields, sensitive account state, and exports use distinct server-side projections and supplemental permissions.
- [x] School profile, Tenant settings, and integrations no longer reuse an unrelated Master Data write decision.
- [x] Zero-role users receive only the fixed no-access/account surface and cannot load dashboard or directory business data directly.
- [x] Same-Tenant missing permission returns safe denial, while foreign Tenant and concealed records remain externally indistinguishable from missing records.
- [x] Navigation consumes effective authorization state but is proven not to replace server enforcement.
- [x] Generated matrix, service, database, HTTP, isolation, and browser tests cover every mapped surface and projection.
