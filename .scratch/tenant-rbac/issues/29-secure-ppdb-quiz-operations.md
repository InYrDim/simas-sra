# 29 — Secure PPDB and quiz operations

**What to build:** Enforce Permission Tenant independently from Provider feature entitlement for authenticated PPDB administration and Ulangan while preserving public and Applicant flows outside Tenant RBAC.

**Blocked by:** 18 — Introduce the centralized evaluator in shadow mode; 20 — Backfill legacy non-admin access without widening; 22 — Deliver multi-role assignment and effective access.

**Status:** resolved

- [x] Every authenticated PPDB and quiz page, action, handler, document, result, export, and mutation uses its exact operation-map permission.
- [x] Read/write feature entitlement, Tenant state, exact permission, contextual policy, sensitive projection, and domain invariant are evaluated as independent gates.
- [x] Applicant and public PPDB operations preserve their existing separate identity and server-derived Tenant policies and do not acquire Tenant permissions.
- [x] PPDB documents and result downloads use private Tenant-qualified lookup and explicit sensitive/download/export permissions.
- [x] Quiz teacher delegation remains denied unless a canonical complete teaching-assignment tuple exists; unrelated class and subject assignments cannot combine.
- [x] Disabled entitlement and missing same-Tenant permission return safe `403`, while foreign and concealed records follow the common `404` contract.
- [x] Navigation reflects both entitlement availability and effective permission without conflating the two or replacing server enforcement.
- [x] Generated matrix, differential isolation, document security, HTTP, and browser tests cover authenticated and intentionally excluded surfaces.

**Implementation note:** Authenticated document downloads now require `ppdb.documents.download` plus `ppdb.documents.view-sensitive`; Tenant exports require `ppdb.submissions.export` plus the sensitive projection. Public Applicant print views remain intentionally outside Tenant RBAC. Browser runtime verification requires restarting the pre-existing Next dev server so it loads the new export route.

## Validation evidence

- `CI=1 pnpm --dir monorepo exec playwright test e2e/ppdb-rbac.spec.ts` — **1 passed**.
- The browser-side export request returned HTTP `200` and a `Content-Disposition` filename containing `ppdb-submissions.csv`.
- `pnpm --dir monorepo exec tsx --test lib/platform/proxy-routing.test.ts` — **13 passed**.
- `pnpm --dir monorepo exec tsc --noEmit` passed after removing the corrupted generated `.next/dev` artifacts.
- The proxy now preserves query parameters during tenant rewrites/redirects, including the export `sessionId`.

## Resolution note

The earlier `404`/hang was caused by corrupted generated Next development route metadata under `.next/dev`, not by the PPDB authorization or export route. The E2E test now uses an authenticated browser `fetch` so it verifies the download response without treating the CSV navigation as a page load.
