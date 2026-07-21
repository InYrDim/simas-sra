# Tenant Master Data Wayfinding Map

## Destination

A decision-complete implementation specification for nine functional Tenant Master Data pages that let a School Admin manage its school's profile and operational reference data safely, including template-based bulk import for Siswa, Guru, and Staf.

## Notes

- Domain: Tenant Master Data owned and isolated by one school.
- Use the `grilling` and `domain-modeling` skills when resolving domain or policy decisions.
- Nine pages are in scope: Profil Sekolah, Siswa, Guru, Staf, Mata Pelajaran, Rombongan Belajar, Sarana & Prasarana, Organisasi & Ekstrakurikuler (renamed from Organisasi), and a new Tahun Ajaran page.
- Profil Sekolah is viewable and editable by School Admin, except NPSN is read-only and remains governed by Provider-side identity data.
- The other eight areas support listing, creating, editing, and archiving/reactivating records; operational records are not hard-deleted.
- Only School Admin may access or mutate Master Data in this effort. Server-side authorization is authoritative; menu filtering alone is insufficient.
- Siswa, Guru, and Staf support downloadable templates followed by bulk import.
- Current code has placeholder routes for the original eight pages, no Tahun Ajaran route, wildcard role visibility in the Tenant menu, and no dedicated Master Data tables in the database schema.
- This map plans the feature; implementation is out of scope until the decisions are complete.

## Decisions so far

<!-- Closed ticket decisions are indexed here. -->

- [Define the Tenant Master Data domain model](./issues/01-define-master-data-domain-model.md) — Tenant-isolated entities use stable identities, separate people from accounts and roles, preserve effective-dated academic/personnel/activity histories, and archive without hard deletion or hidden cascades.
- [Define the School Admin authorization boundary](./issues/02-define-school-admin-authorization-boundary.md) — Server-side, fail-closed authorization binds the current School Admin, URL domain, Tenant, records, lifecycle policy, and every import stage while treating menu filtering as navigation only.
- [Specify Tahun Ajaran, Mata Pelajaran, and Rombongan Belajar contracts](./issues/05-specify-academic-reference-contracts.md) — Academic references use explicit forward-only periods, stable catalogs, year-scoped class groups, effective-dated memberships and homeroom assignments, and non-cascading lifecycle controls.
- [Specify Sarana Prasarana and Organisasi Ekstrakurikuler contracts](./issues/06-specify-facility-and-organization-contracts.md) — Separate location and asset inventories, organization leadership and membership histories, and yearly extracurricular groups use explicit lifecycle and referential constraints without hidden cascades.
- [Specify Siswa, Guru, and Staf record contracts](./issues/04-specify-people-record-contracts.md) — Shared Warga Sekolah identities support distinct lifecycle-aware people profiles, strict identifiers and duplicate review, account separation, consistent list/edit behavior, and non-destructive archive/reactivation.
- [Specify the School Profile contract](./issues/03-specify-school-profile-contract.md) — Profil Sekolah separates read-only Provider identity from validated School Admin-managed attributes, managed assets, structured histories, completeness, audit, and conflict-safe updates.
- [Design the people template import workflow](./issues/07-design-template-import-workflow.md) — Spreadsheet-first review uses versioned XLSX templates, explicit identity decisions, reviewed partial execution with row-atomic commits, correction revisions, idempotent retries, and durable per-row results.
- [Define the consistent Master Data UX](./issues/08-define-consistent-master-data-ux.md) — A task-oriented `/master` overview leads into consistent split list/detail entity workspaces with URL-backed state, domain-specific forms and lifecycle actions, responsive behavior, and accessible loading/error/empty patterns.
- [Plan the Master Data implementation sequence and validation](./issues/09-plan-master-data-implementation-and-validation.md) — Deployment-safe vertical slices use additive migrations, evidence-gated feature-flag rollout, real-MySQL and browser validation, invariant reconciliation, durable import jobs, and targeted rollback/repair.
- [Implement basic School Profile management](./issues/03-manage-basic-school-profile.md) — Tenant profiles are lazy and unique, Provider identity remains read-only, operational edits use allowlisted validation and optimistic concurrency, and audit writes are transactionally atomic.
- [Manage school logo and accreditation history](./issues/04-manage-school-logo-and-accreditation.md) — Tenant-scoped protected logo storage validates actual image content with atomic cleanup, while accreditation corrections append replacements and preserve invalidated history without overlapping periods.
- [Support multi-profile Warga Sekolah](./issues/11-support-multi-profile-school-person.md) — Shared identity edits disclose affected profiles, aggregate archive waits for every independent profile archive, reactivation restores only the person and selected profile, and account links remain separate.

## Not yet specified

None. The implementation specification is decision-complete for the stated destination.

## Out of scope

- Granting Master Data permissions to Tenant roles other than School Admin.
- Bulk import for Mata Pelajaran, Rombongan Belajar, Sarana & Prasarana, or Organisasi & Ekstrakurikuler.
- Hard deletion of operational Master Data records.
- Changing NPSN from the Tenant workspace.
- Implementing downstream modules that consume Master Data.
- Constraints introduced by future Absensi, Penjadwalan, PPDB, or Manajemen Pengguna relationships; those modules must define their own blockers against the stable Master Data contracts when designed.
- General exports, external-system synchronization, and bulk operations beyond the approved Siswa/Guru/Staf import workflow; these require separate future efforts rather than blocking this specification.
