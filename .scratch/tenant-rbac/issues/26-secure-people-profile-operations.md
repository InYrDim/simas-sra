# 26 — Secure people and profile operations

**What to build:** Apply exact composite permissions, sensitive projections, Tenant isolation, and contextual self/assigned rules to Warga Sekolah and Profil Siswa, Profil Guru, and Profil Staf operations.

**Blocked by:** 18 — Introduce the centralized evaluator in shadow mode; 20 — Backfill legacy non-admin access without widening; 22 — Deliver multi-role assignment and effective access.

**Status:** implemented

- [x] Every people and profile page, action, handler, download, and mutation is mapped to and enforced by its exact permission set.
- [x] Operations requiring both shared Warga Sekolah capability and profile-specific capability reject either permission missing; dependencies do not create hidden runtime inheritance.
- [x] Ordinary, contact, sensitive, document, and export projections are independently enforced and masked or omitted on the server.
- [x] Self scope requires the exact same-Tenant Akun Pengguna-to-Warga Sekolah link and never follows email, creator, audit actor, role name, or profile kind.
- [x] Assigned scope uses complete canonical current relationships, deduplicates multiple valid paths, and rejects future, expired, suspended, archived, ambiguous, or cross-Tenant relationships.
- [x] Lists, counts, search, matching candidates, exports, and bulk previews exclude concealed records before result construction.
- [x] Profile creation, archival, linking, and account lifecycle do not implicitly grant or remove Role Tenant assignments.
- [x] Generated matrix, service, database, differential non-enumeration, projection, and browser tests cover every mapped surface.

## Comments

- Exact permissions, server-side projections, self scope, and non-implicit Role Tenant lifecycle behavior are implemented and covered by the existing authorization/master-data changes.
- Canonical `assigned` scope uses Issue 34's `teaching_assignment` relationship, including effective-date, lifecycle, archive, profile-status, Tenant, and composite relationship checks.
- People/profile result construction applies self and assigned visibility before projection, filtering, counts, search, matching candidates, exports, and bulk previews.
- Generated matrix, service, database, differential non-enumeration, projection, and browser coverage is complete for the mapped surfaces.
