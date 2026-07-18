# 12 — Cut over routing and finalize lifecycle constraints

**What to build:** SIMAS exposes only the canonical guarded `/provider/*` area on the main host, removes the obsolete Provider dashboard and direct Tenant creation flow, and finalizes database constraints only after target data is proven safe.

**Blocked by:** 04 — Introduce the guarded Provider shell and real navigation routes; 07 — Approve Pengajuan SIMAS and provide a Tenant atomically; 09 — Complete Onboarding Tenant and start Trial Tenant once; 10 — Manage and inspect provided Tenants; 11 — Deliver the Provider operational summary.

**Status:** resolved

- [x] Main-host `/provider/*` requests pass through without rewrite, while Tenant hosts neither rewrite nor expose Provider routes and ordinary Tenant routes still work.
- [x] Obsolete `/dashboard` and `/dashboard/onboarding` Provider routes, redirects, rewrites, aliases, compatibility catch-alls, and direct Tenant creation action are removed; both old paths return 404 on the main host.
- [x] All Provider links, fixtures, and tests use canonical `/provider/*` routes.
- [x] Final non-null and unique Tenant constraints are applied only after a validated development reset or an explicitly approved retained-data backfill; no migration invents NPSN, source Pengajuan, or lifecycle timestamps.
- [x] Any persisted external `superadmin` values discovered by the deployment audit are migrated atomically to `school-admin`; no fake role SQL is generated when such persistence does not exist.
- [x] Generated migrations run successfully and integrity checks cover grants, one-to-one Pengajuan–Tenant relationships, activation records, and lifecycle timestamps.
- [x] Type checking/build, linting, domain tests, database and Better Auth integrations, guard boundaries, proxy routing, and Provider sidebar accessibility validation pass.
