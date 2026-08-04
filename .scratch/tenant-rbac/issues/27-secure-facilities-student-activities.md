# 27 — Secure facilities and student-activity operations

**What to build:** Replace broad authorization across Lokasi/Ruang, Aset/Barang, Organisasi Siswa, and Ekstrakurikuler with complete operation-level Tenant RBAC enforcement.

**Blocked by:** 18 — Introduce the centralized evaluator in shadow mode; 20 — Backfill legacy non-admin access without widening; 22 — Deliver multi-role assignment and effective access.

**Status:** ready-for-human

- [x] Every covered page, server action, handler, export, and mutation uses its exact canonical permission and remains Tenant-qualified at the data boundary.
- [x] Create, update, archive, restore, lifecycle, membership, assignment, adjustment, and export operations remain distinct where specified.
- [x] Sensitive fields and exports require their supplemental permissions and cannot be exposed through nested relations or generated files. (Verified: these four resources expose no sensitive projection or export entry point.)
- [x] Free-text staff unit values never grant contextual Unit access; unsupported delegated unit operations remain School Admin-only or denied. (N/A for the four resource surfaces; regression test confirms `workUnit` is not an authorization scope.)
- [x] Collection and direct-record behavior follows the common filtering and concealed-response contracts.
- [x] Domain invariants, optimistic versions, write restrictions, and atomic audit are revalidated for every mutation.
- [x] Navigation visibility follows effective access without becoming an enforcement source.
- [x] Generated matrix, database, HTTP, isolation, concurrency, and browser tests cover each resource and operation.
