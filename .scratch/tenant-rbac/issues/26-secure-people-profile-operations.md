# 26 — Secure people and profile operations

**What to build:** Apply exact composite permissions, sensitive projections, Tenant isolation, and contextual self/assigned rules to Warga Sekolah and Profil Siswa, Profil Guru, and Profil Staf operations.

**Blocked by:** 18 — Introduce the centralized evaluator in shadow mode; 20 — Backfill legacy non-admin access without widening; 22 — Deliver multi-role assignment and effective access.

**Status:** ready-for-agent

- [ ] Every people and profile page, action, handler, download, and mutation is mapped to and enforced by its exact permission set.
- [ ] Operations requiring both shared Warga Sekolah capability and profile-specific capability reject either permission missing; dependencies do not create hidden runtime inheritance.
- [ ] Ordinary, contact, sensitive, document, and export projections are independently enforced and masked or omitted on the server.
- [ ] Self scope requires the exact same-Tenant Akun Pengguna-to-Warga Sekolah link and never follows email, creator, audit actor, role name, or profile kind.
- [ ] Assigned scope uses complete canonical current relationships, deduplicates multiple valid paths, and rejects future, expired, suspended, archived, ambiguous, or cross-Tenant relationships.
- [ ] Lists, counts, search, matching candidates, exports, and bulk previews exclude concealed records before result construction.
- [ ] Profile creation, archival, linking, and account lifecycle do not implicitly grant or remove Role Tenant assignments.
- [ ] Generated matrix, service, database, differential non-enumeration, projection, and browser tests cover every mapped surface.
