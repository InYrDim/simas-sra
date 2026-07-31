# 25 — Secure academic and class operations

**What to build:** Enforce exact permissions and contextual policies across Tahun Ajaran, Mata Pelajaran, Rombongan Belajar, Keanggotaan Rombongan Belajar, and Wali Kelas operations.

**Blocked by:** 18 — Introduce the centralized evaluator in shadow mode; 20 — Backfill legacy non-admin access without widening; 22 — Deliver multi-role assignment and effective access.

**Status:** ready-for-agent

- [ ] Every academic and class page, query, action, handler, download, and mutation uses its exact operation-map permission rather than a broad read/write or role-name check.
- [ ] Read/write Tenant state, feature entitlement where applicable, optimistic versions, lifecycle transitions, and domain invariants remain independent required gates.
- [ ] Wali Kelas contextual access includes only currently effective eligible relationships and never implies teaching-subject authority.
- [ ] Collection filtering occurs before search, count, facets, ordering, pagination, autocomplete, print, export, and bulk preview.
- [ ] Foreign Tenant, nonexistent, and same-Tenant out-of-scope direct records share the approved concealed response contract.
- [ ] Context loss between preview and commit aborts the complete mutation without disclosing which concealed target failed.
- [ ] Unsupported teaching delegation remains denied until a canonical complete teaching-assignment tuple exists.
- [ ] Generated matrix, real database, HTTP, race, and two-Tenant tests cover every declared operation and contextual arm.
