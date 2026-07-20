# Tenant Master Data

Status: ready-for-agent

## Problem Statement

School Admin belum memiliki permukaan kerja yang fungsional dan aman untuk mengelola identitas operasional sekolah serta data referensi yang dipakai ulang oleh fitur sekolah. Delapan route Master Data yang ada masih berupa placeholder, route Tahun Ajaran dan overview `/master` belum tersedia, menu masih terlihat untuk seluruh role Tenant, dan database belum memiliki model khusus untuk Master Data.

Tanpa model yang terisolasi per Tenant, lifecycle yang eksplisit, riwayat yang tetap utuh, dan authorization server-side, sekolah berisiko menggandakan identitas orang, menimpa sejarah akademik atau kepegawaian, memakai referensi yang sudah tidak aktif, dan melihat atau mengubah data milik Tenant lain. School Admin juga membutuhkan cara aman untuk memasukkan Siswa, Guru, dan Staf dalam jumlah besar tanpa membuat akun, kehilangan leading zero pada identifier, menggabungkan orang secara otomatis, atau menggandakan data ketika pekerjaan impor dicoba ulang.

Fitur ini harus menghasilkan sembilan halaman Master Data yang lengkap—Profil Sekolah, Siswa, Guru, Staf, Mata Pelajaran, Rombongan Belajar, Sarana & Prasarana, Organisasi & Ekstrakurikuler, dan Tahun Ajaran—ditambah overview `/master`. Seluruh permukaan hanya dapat diakses School Admin dari Tenant yang sedang aktif dan harus mempertahankan Tenant isolation, stable identity, effective-dated history, non-destructive archive, auditability, dan safe rollout.

## Solution

Sediakan bounded context Tenant Master Data yang menyimpan setiap record operasional di bawah satu Tenant dan membedakan secara tegas antara identitas Provider, profil operasional sekolah, Warga Sekolah, profil Siswa/Guru/Staf, Akun Pengguna, stable catalogs, serta relationship histories.

School Admin menggunakan `/master` sebagai ringkasan tindakan lintas-entitas, kemudian mengelola record melalui workspace list/detail yang konsisten. Detail bersifat read-only secara default; create/edit, lifecycle transition, archive, dan reactivation memakai action flow khusus dengan server validation, optimistic concurrency, audit, dan blocker yang eksplisit. Record operasional tidak dihapus permanen dan archive tidak menyembunyikan atau memutus history secara otomatis.

Profil Sekolah menampilkan identitas resmi Provider secara read-only dan mengizinkan School Admin mengelola atribut operasional. Siswa, Guru, dan Staf berbagi identitas Warga Sekolah tetapi memiliki profile dan lifecycle sendiri, terpisah dari Akun Pengguna. Tahun Ajaran, Semester, Mata Pelajaran, Rombongan Belajar, membership, Wali Kelas, fasilitas, aset, organisasi, kepengurusan, ekstrakurikuler, dan kelompok kegiatan mempertahankan stable identity serta effective-dated histories sesuai kontrak domain masing-masing.

Siswa, Guru, dan Staf mendukung workbook `.xlsx` terpisah dan berversi. Upload divalidasi oleh durable background job tanpa menulis Master Data. School Admin meninjau hasil dalam spreadsheet review, menyelesaikan kemungkinan identitas yang sama, lalu mengeksekusi baris eligible secara partial dengan transaksi atomik per baris dan idempotent retry.

Seluruh read dan mutation melalui authorization predicate yang memvalidasi session, domain, Tenant, role School Admin, Tenant lifecycle, record ownership, archive state, dan feature flag. Delivery dilakukan sebagai deployment-safe vertical slices dengan additive migrations, real-MySQL integration tests, critical browser E2E, invariant reconciliation, evidence-based rollout gates, dan targeted repair alih-alih destructive rollback.

## User Stories

1. As a School Admin, I want to open a Master Data overview, so that I can see what reference data needs attention.
2. As a School Admin, I want overview metrics to link to deterministic filtered lists, so that I can act on the records behind each metric.
3. As a School Admin, I want recent Master Data activity summarized without sensitive before/after values, so that I can understand meaningful changes safely.
4. As a School Admin, I want quick actions for creation and supported imports, so that common work is reachable without navigating several menus.
5. As a non-School-Admin Tenant user, I want Master Data hidden and inaccessible, so that confidential operational data is protected from unauthorized roles.
6. As a School Admin, I want direct URLs checked by the server, so that menu visibility is never treated as authorization.
7. As a School Admin, I want URL domain and session Tenant to match, so that I cannot accidentally operate in another school.
8. As a School Admin, I want cross-Tenant and unknown record identifiers to return indistinguishable not-found responses, so that record existence is not disclosed.
9. As a School Admin in an active or active-trial Tenant, I want full permitted Master Data access, so that I can operate the school.
10. As a School Admin in an expired trial, I want read-only access and template download, so that I can inspect data without making prohibited mutations.
11. As a School Admin in a suspended Tenant, I want read-only access without template download or mutation, so that suspension policy is enforced consistently.
12. As a user of a closed or unverifiable Tenant, I want Master Data denied fail-closed, so that uncertain lifecycle state cannot grant access.
13. As a School Admin, I want every list, detail, history, relation, and import lookup scoped by authoritative `tenantId`, so that client-provided ownership is never trusted.
14. As a School Admin, I want the official school name, NPSN, education level, and domain displayed read-only, so that Provider identity cannot be changed from the Tenant workspace.
15. As a School Admin, I want to manage the school display name, logo, address, contacts, website, coordinates, and description, so that operational school information remains current.
16. As a School Admin, I want profile input to reject Provider-controlled fields rather than silently ignore them, so that attempted boundary violations are visible.
17. As a School Admin, I want managed logo upload with type, size, content, and safe-storage validation, so that school branding is secure.
18. As a School Admin, I want effective-dated headmaster assignments to active Guru, so that changes preserve leadership history.
19. As a School Admin, I want accreditation history rather than one overwritten accreditation value, so that prior accreditation remains auditable.
20. As a School Admin, I want profile completeness to distinguish required and recommended information, so that I know what operational data is missing.
21. As a School Admin, I want stale profile updates rejected while preserving my input, so that concurrent edits do not silently overwrite each other.
22. As a School Admin, I want to create a Warga Sekolah with shared personal identity, so that personal data has one canonical record inside my Tenant.
23. As a School Admin, I want one Warga Sekolah to hold Siswa, Guru, and/or Staf profiles, so that multi-role people are not duplicated.
24. As a School Admin, I want profile creation to remain separate from Akun Pengguna, so that creating Master Data never grants system access.
25. As a School Admin, I want to see whether a Warga Sekolah is linked to an account, so that I can coordinate with Manajemen Pengguna without changing accounts here.
26. As a School Admin, I want NIK and NIP stored as optional textual identifiers with Tenant-local uniqueness, so that leading zeros and identity integrity are preserved.
27. As a School Admin, I want possible duplicate people surfaced for review, so that similar people are not merged automatically.
28. As a School Admin, I want to attach a missing profile to an explicitly selected existing Warga Sekolah, so that shared identity is reused safely.
29. As a School Admin, I want hard identifier conflicts and existing target profiles rejected, so that duplicate identities or profiles cannot be created.
30. As a School Admin, I want to create a Siswa with NIS, entry date, and status, so that student identity and lifecycle are complete.
31. As a School Admin, I want NIS and optional 10-digit NISN stored as Tenant-unique text, so that school and national identifiers remain exact.
32. As a School Admin, I want Siswa lifecycle changes to require effective dates and reasons where applicable, so that graduation, transfer, and exit remain historical facts.
33. As a School Admin, I want graduation treated as final for ordinary academic work but correctable through an audited special action, so that errors can be repaired without casual reversal.
34. As a School Admin, I want Rombongan Belajar membership stored separately from Siswa, so that class history is not overwritten.
35. As a School Admin, I want to create a Guru with internal number, employment type, service start, and assignment status, so that teaching personnel have an operational profile.
36. As a School Admin, I want optional 16-digit NUPTK and internal Guru number validated and Tenant-unique, so that Guru identifiers remain reliable.
37. As a School Admin, I want Guru transitions among Aktif, Cuti, and Berakhir to preserve effective dates and reasons, so that employment history is auditable.
38. As a School Admin, I want to create a Staf with internal number, position, employment type, service start, and assignment status, so that non-teaching personnel have an operational profile.
39. As a School Admin, I want Staf position changes to close the old assignment and create a new history entry, so that position history is not overwritten.
40. As a School Admin, I want closed structured values for gender, religion, employment type, and default positions, so that validation and reporting use stable codes.
41. As a School Admin, I want shared personal fields normalized and validated consistently in forms and imports, so that entry method does not change correctness.
42. As a School Admin, I want to search Siswa, Guru, and Staf by names and identifiers, so that I can find people quickly.
43. As a School Admin, I want people lists to show profile-specific identifiers, lifecycle, archive, and account-link status, so that I can distinguish operational state from login access.
44. As a School Admin, I want to archive a Siswa profile only after it is Lulus, Pindah, or Keluar, so that active academic records are not hidden.
45. As a School Admin, I want to archive Guru or Staf only after status Berakhir, so that active or on-leave personnel remain operationally visible.
46. As a School Admin, I want active relationship blockers enumerated before archive, so that archive does not break current operations.
47. As a School Admin, I want an active linked account to produce a warning rather than silently block or disable it, so that account lifecycle remains owned by Manajemen Pengguna.
48. As a School Admin, I want reactivation to revalidate uniqueness and relationships without restoring old relationships or lifecycle state, so that reactivated records are safe and explicit.
49. As a School Admin, I want to create a Tahun Ajaran with explicit dates and exactly Ganjil and Genap semesters, so that academic periods are stable and complete.
50. As a School Admin, I want semester dates contained, ordered, contiguous, and non-overlapping within the year, so that period boundaries are unambiguous.
51. As a School Admin, I want academic lifecycle transitions to be explicit and forward-only, so that calendar dates never activate or close periods automatically.
52. As a School Admin, I want at most one active Tahun Ajaran and one active Semester per Tenant, so that current academic context is deterministic.
53. As a School Admin, I want only Ditutup or Dibatalkan years archivable, so that operational lifecycle and archive state remain distinct.
54. As a School Admin, I want to maintain a stable Mata Pelajaran catalog independent of year, teacher, load, passing threshold, and schedule, so that downstream modules can reference it safely.
55. As a School Admin, I want subject codes and names Tenant-unique under their defined normalization, so that catalog entries are unambiguous.
56. As a School Admin, I want to create Rombongan Belajar within one Tahun Ajaran, education level, and grade, so that class groups are period-specific.
57. As a School Admin, I want year, education level, and grade immutable after a Rombongan Belajar becomes active, so that historical meaning cannot drift.
58. As a School Admin, I want to plan one future Rombel membership while preserving the current membership, so that transition to a Draft academic year can be prepared.
59. As a School Admin, I want transfers to close the old membership and open the new membership atomically, so that a Siswa never has conflicting active classes.
60. As a School Admin, I want promotion to remain explicit rather than automatic, so that School Admin controls academic placement.
61. As a School Admin, I want effective-dated Wali Kelas assignments to active Guru, so that replacements preserve history without implying teaching assignments.
62. As a School Admin, I want a Guru limited to one active Wali Kelas assignment per Tahun Ajaran, so that conflicting homeroom responsibility is prevented.
63. As a School Admin, I want to manage Lokasi/Ruang in an acyclic hierarchy, so that physical locations can be organized safely.
64. As a School Admin, I want a location archive blocked by active children or references, so that the hierarchy and active assets remain valid.
65. As a School Admin, I want to manage grouped and individually tracked Aset/Barang, so that inventory granularity matches the asset.
66. As a School Admin, I want asset quantity, condition, and location changes recorded with before/after values, actor, time, and reason, so that inventory history remains auditable.
67. As a School Admin, I want asset quantity changes transactionally prevented from going negative, so that inventory cannot enter an impossible state.
68. As a School Admin, I want facility and asset identities retained after archive, so that old references and codes remain unambiguous and reactivation is preferred over recreation.
69. As a School Admin, I want to maintain stable Organisasi Siswa identities across governance periods, so that history is not split into duplicate organizations.
70. As a School Admin, I want effective-dated Periode Kepengurusan and leadership assignments, so that organization leadership changes preserve history.
71. As a School Admin, I want leadership to require active organization membership, so that office holders are valid members.
72. As a School Admin, I want ending a leadership assignment not to end general membership automatically, so that distinct relationships remain independent.
73. As a School Admin, I want to maintain stable Ekstrakurikuler identities and year-specific Kelompok Kegiatan, so that activities persist while yearly execution changes.
74. As a School Admin, I want extracurricular advisors to reference active Guru or Staf and participants to reference active Siswa, so that group membership uses valid people profiles.
75. As a School Admin, I want participant capacity enforced as a hard limit, so that a group cannot exceed its declared capacity.
76. As a School Admin, I want archive blockers for organizations, extracurriculars, periods, groups, memberships, advisors, and locations displayed explicitly, so that no relationship disappears through a hidden cascade.
77. As a School Admin, I want separate versioned `.xlsx` templates for Siswa, Guru, and Staf, so that each import uses the correct contract.
78. As a School Admin, I want template instructions, data columns, and controlled references bundled together, so that I can prepare data accurately.
79. As a School Admin, I want identifier columns formatted as text and dates documented as `YYYY-MM-DD`, so that spreadsheet software does not corrupt values.
80. As a School Admin, I want unsupported, corrupted, password-protected, macro-enabled, formula-bearing, oversized, or structurally ambiguous workbooks rejected safely, so that imports cannot execute unsafe content.
81. As a School Admin, I want upload validation to create an immutable revision without writing Master Data, so that I can review before execution.
82. As a School Admin, I want each import row classified as Siap, Peringatan, or Ditolak with field-level findings, so that corrections and decisions are actionable.
83. As a School Admin, I want to search and filter the spreadsheet review by row, identifier, state, and problematic column, so that large imports remain manageable.
84. As a School Admin, I want exact identifiers belonging to an existing Warga Sekolah without the target profile treated as an explicit strong link candidate, so that a legitimate second profile is not rejected as a duplicate person.
85. As a School Admin, I want possible matches compared with only necessary Tenant-local fields, so that I can choose link, create-distinct, or skip without overexposure.
86. As a School Admin, I want shared-person conflicts prevented from silently overwriting existing Warga Sekolah data, so that imports cannot mutate identity implicitly.
87. As a School Admin, I want to execute eligible reviewed rows while rejected and skipped rows remain uncommitted, so that one bad row does not block all valid work.
88. As a School Admin, I want each selected row atomic across person, profile, initial history, audit, and success marker, so that partial record creation cannot occur.
89. As a School Admin, I want import retries and worker restarts to skip committed rows, so that at-least-once delivery cannot create duplicates.
90. As a School Admin, I want corrected workbooks to create a new immutable revision, so that previous validation and decisions remain auditable.
91. As a School Admin, I want per-row terminal outcomes and downloadable correction/result workbooks, so that failures can be repaired outside the browser.
92. As a School Admin, I want imports never to create, invite, link, or authorize Akun Pengguna, so that profile import cannot grant access.
93. As a School Admin, I want import jobs to recheck my current authority and Tenant mutation state before committing rows, so that revoked access cannot continue writing.
94. As a School Admin, I want another currently authorized School Admin to review and start a new execution from an unexecuted batch revision when policy permits, so that valid Tenant-owned work is not permanently stranded by staff turnover.
95. As a School Admin, I want list search, filters, sort, pagination, archive scope, and selection encoded in the URL, so that reload, share, and browser navigation preserve context.
96. As a School Admin, I want true-empty, filtered-zero-result, loading, error, and archived states to be distinct, so that the interface always explains what happened.
97. As a School Admin, I want detail read-only by default and structured lifecycle operations separated from ordinary edits, so that consequential changes remain explicit.
98. As a School Admin, I want forms to preserve input, summarize errors, focus the first invalid field, and warn about unsaved changes, so that correction is efficient and accessible.
99. As a School Admin, I want desktop split view, tablet detail sheets, and mobile full-screen detail, so that Master Data remains usable across screen sizes.
100. As a keyboard or screen-reader user, I want semantic structure, labelled controls, predictable focus, live announcements, textual status, and sufficient contrast, so that every workflow is accessible.
101. As an operator, I want every successful mutation and import outcome correlated with Tenant, actor, operation, time, and record, so that incidents and support questions are traceable.
102. As an operator, I want reconciliation scripts to detect Tenant, uniqueness, lifecycle, relationship, audit, and import invariants, so that rollout depends on evidence rather than page availability.
103. As an operator, I want narrow read/write/import feature flags, so that an affected mutation can stop while safe reads remain available.
104. As an operator, I want additive schema-compatible rollback and targeted repair, so that recovering one feature does not erase valid writes from other Tenants.

## Implementation Decisions

### Authorization and ownership

- Introduce one authoritative Tenant Master Data access policy that derives the canonical Tenant from the validated session and URL domain, requires current `school-admin` membership in that Tenant, evaluates Tenant lifecycle and typed feature policy, and fails closed.
- Use the policy at page, server-action/handler, domain-command, read-repository, file, and worker boundaries. Navigation filtering is presentational only.
- Scope every operational query by both `tenantId` and record identity. Prevent cross-Tenant relationships structurally with Tenant-owned keys and transactionally where database constraints cannot express the invariant.
- Return login redirect for unauthenticated access, `403` for an authenticated matching-Tenant user without School Admin, and `404` for unknown/mismatched Tenant, domain, or record. Do not disclose cross-Tenant existence.
- Treat archived records as readable but immutable and unavailable for new relationships, except for reactivation after current validation.
- Record successful mutations as audit events. Record cross-Tenant attempts, unauthorized-role attempts, and denied read-only mutations as security events without sensitive payloads.

### Module and test seams

- Use domain-command modules as the primary behavioral seam. A command receives an authenticated canonical principal, validated input, clock/ID dependencies, and a small transaction-oriented store interface.
- Keep route handlers and server actions thin: parse transport input, call the command/query seam, and map domain results to HTTP/UI outcomes.
- Use separate read-model/query modules for URL query normalization, filters, sorting, pagination, and projection. Do not mock Drizzle’s fluent query builder as proof of SQL correctness.
- Implement Drizzle/MySQL adapters behind the transaction-oriented store and query interfaces. Audit/outbox intent is written in the same transaction as each mutation.
- Add a typed feature-policy module rather than reading raw feature strings from flexible Tenant settings throughout the codebase.
- Add explicit storage and durable-job interfaces before implementing logos, accreditation files, or import workbooks; contract-test concrete adapters separately.
- Add Playwright for a deliberately small critical E2E suite. Do not introduce broad component-test infrastructure unless a client-only state machine cannot be tested through a pure module.

### Core persistence model

- Every Master Data entity has a stable internal identifier, explicit `tenantId`, creation/update metadata, archive metadata where applicable, and optimistic concurrency token/version where editable.
- Stable business identifiers and codes remain reserved inside a Tenant after archive. Reactivation is preferred over recreation; reactivation cannot silently take another record’s identity.
- Separate current queryable state from append-preserving lifecycle, assignment, membership, quantity, condition, location, and audit histories.
- Do not hard-delete operational records. Do not implement hidden cascade archive, lifecycle transition, or relationship termination.
- Use closed stable codes for structured choices. Display labels are localized Indonesian text and are not persisted as mutable domain meaning.

### Profil Sekolah

- Keep Provider identity authoritative for NPSN, official school name, education level, domain, and Tenant lifecycle. Profil Sekolah references the Tenant and does not duplicate these as editable fields.
- Maintain exactly one operational profile per Tenant, created lazily or idempotently bootstrapped. Authoritative provisioning values may be copied only when their provenance is known and the destination is a School Admin-managed field; missing values are never invented.
- Store display name, managed logo reference, structured address, institutional email/telephone, website, coordinates, description, completeness state, and concurrency version.
- Store headmaster and accreditation as effective-dated histories. Enforce no overlapping current headmaster assignment and require referenced active Guru.
- Use an allowlisted mutation schema that rejects Provider-owned fields.
- Provider Admin access to Tenant profile history is not introduced by this spec; any Provider-side support view requires its own authorization path and specification.

### Warga Sekolah and people profiles

- Store shared personal identity on Warga Sekolah and profile-specific fields on Siswa, Guru, and Staf. Enforce at most one profile of each type per Warga Sekolah and at most one optional Akun Pengguna link in the same Tenant.
- NIP belongs to Warga Sekolah. NIS/NISN belong to Siswa; internal Guru number and NUPTK belong to Guru; internal Staf number belongs to Staf.
- Normalize whitespace, empty optional values, email casing, telephone form, and identifier punctuation consistently in forms and imports. Persist numeric identifiers as text.
- Use exact identifier collisions to identify either an existing same Warga Sekolah or an incompatible conflict. Permit explicit profile attachment only when the existing Warga Sekolah lacks the target profile and shared identity is compatible; otherwise reject.
- Similar name/birth/place/contact combinations create review warnings, never automatic links or merges.
- Expose shared Warga Sekolah edits from profile detail with disclosure that changes affect other profiles. Sensitive identifier changes retain before/after audit values.
- Warga Sekolah archive is a separate explicit aggregate action available only after all profiles are archived; it is not automatic. Reactivating a profile first reactivates its Warga Sekolah when current uniqueness checks pass, but does not restore any other profile or relationship.
- Keep account creation, linking/unlinking, role assignment, invitations, and account deactivation outside Master Data.

### People lifecycle

- Siswa starts Aktif and may transition to Lulus, Pindah, or Keluar with the required effective date/reason rules. Pindah/Keluar may return as Aktif; Lulus correction requires a special audited action.
- Guru and Staf use Aktif, Cuti, and Berakhir with effective dates, planned Cuti end where supplied, and structured Berakhir reasons. Returning from Berakhir creates a new service period.
- Prevent overlapping periods and dates before school/service entry. Scheduled future people-status transitions are not included.
- Archive eligibility depends on terminal profile status and absence of blocking active relationships. Active accounts warn but do not block.

### Academic references

- Tahun Ajaran owns exactly Ganjil and Genap semesters. Validate contained, ordered, contiguous, non-overlapping ranges and one active year/semester per Tenant.
- Use explicit forward-only lifecycle commands for activation, semester progression, closure, and cancellation. Dates never trigger transitions automatically.
- Mata Pelajaran is a stable catalog independent of year, grade, teacher, load, threshold, and schedule.
- Rombongan Belajar belongs to one Tahun Ajaran and retains effective-dated Siswa membership and Wali Kelas assignments.
- Enforce at most one current membership, one permitted planned Draft-year membership, atomic transfers, and no automatic promotion.
- Enforce at most one current Wali Kelas per Rombel and one active Rombel per Guru within a Tahun Ajaran. Wali Kelas does not imply subject teaching.

### Facilities and activities

- Keep Sarana & Prasarana as its own page with distinct Lokasi/Ruang and Aset/Barang views. Keep Organisasi & Ekstrakurikuler as a separate page; any prior wording placing facilities under that page is superseded.
- Model Lokasi/Ruang as an acyclic Tenant-local hierarchy with archive blockers for active children and references.
- Model grouped and individual Aset/Barang separately through tracking mode while sharing stable asset identity. Enforce non-negative quantity transactionally and append quantity, condition, and location histories with reason and actor.
- Model Organisasi Siswa and Ekstrakurikuler as stable catalogs across years.
- Model Periode Kepengurusan, organization membership, leadership assignment, Kelompok Kegiatan, advisor assignment, and participant membership as explicit effective-dated relationships.
- A leadership assignment declares whether its free-text position permits multiple concurrent holders; the setting is part of that period’s position definition/assignment contract because no Tenant-managed position catalog exists in this release.
- Require leadership holders to be active organization members; ending leadership does not end membership.
- Require active Guru/Staf advisors and active Siswa participants; enforce declared group capacity.
- Future-dated relationships are allowed only where they represent planning inside a Draft/not-yet-active containing period. Historical correction of terminal periods uses a special audited action and cannot violate dependent ranges or references.

### Shared UX

- Add `/master` as task-oriented overview, not another editing surface. Metrics and exceptions must be contractually defined and link to URL-backed filtered entity pages.
- Use a split list/detail workspace for the eight multi-record pages. Profil Sekolah uses the same header, form, validation, audit, loading, error, and concurrency patterns without an artificial list.
- Encode search, filters, sort, page/page size, archive scope, and selected record in the URL. Use server pagination with 25 default and 25/50/100 options.
- Distinguish archive scope (`Aktif`, `Diarsipkan`, `Semua`) from each entity’s domain lifecycle status and relationship activity. UI copy must not overload these concepts.
- Keep detail read-only by default. Use dedicated forms for creation/complex edit and dedicated actions for lifecycle, archive, and reactivation.
- Preserve input on validation/conflict errors, provide linked error summaries, focus the first invalid field, warn on unsaved navigation, and reject stale writes.
- Use distinct first-use empty, filtered-zero-result, loading, region error, read-only, archived, and conflict states.
- Desktop uses split view; tablet may use a detail sheet; mobile uses essential-field cards/list and full-screen detail.
- Meet keyboard, focus-management, screen-reader announcement, text-status, contrast, reduced-motion, reflow, and touch-target requirements. UI copy and formatting use Indonesian locale.

### Import templates and validation

- Generate separate `.xlsx` templates for Siswa, Guru, and Staf from the same server contract used by validation.
- Include `Petunjuk`, `Data`, and protected `Referensi` sheets plus machine-readable entity kind and semantic template version. Do not trust filename as type/version.
- Limit workbooks to 10 MB and 5,000 data rows. Reject password protection, macros, formula cells, external links, embedded images, corruption, unsupported versions, and ambiguous structures.
- Store identifier cells as text and document `YYYY-MM-DD` dates. Accept the current major and explicitly supported prior majors; additive optional changes increment minor version and incompatible changes increment major.
- Upload creates a Tenant-scoped Batch Impor Orang. Durable parsing/validation creates an immutable Revisi Impor and writes no Master Data.
- Classify each row as Siap, Peringatan, or Ditolak with stable field-level finding codes. Revalidate all ordinary form rules.
- Treat an exact identifier resolving to one compatible existing Warga Sekolah without the target profile as a strong explicit-link decision, not a generic hard rejection. Reject ambiguous ownership, incompatible shared identity, or an already-existing target profile.
- Possible matches support exactly link-and-add-profile, create-distinct, or skip. Never auto-merge or overwrite shared person fields.

### Import execution, ownership, and retention

- Use reviewed partial execution. Freeze the selected revision and row set at confirmation. Require all warning decisions and display exact create/link/skip/reject counts.
- Make each selected row atomic across Warga Sekolah, target profile, initial lifecycle/history, audit, and success marker. The batch is not one global transaction.
- Bind execution idempotency to Tenant, batch, revision, and selected row set. Assume at-least-once delivery and skip success-marked rows on restart.
- Recheck Tenant, feature state, lifecycle, current executing School Admin authority, row validity, uniqueness, and match eligibility before commit.
- The initiating actor remains audit provenance, but an unexecuted Tenant-owned revision may be resumed and confirmed by another currently authorized School Admin after revalidation; every changed decision and execution records the new actor.
- Import creates new profiles or explicitly adds a profile to an existing Warga Sekolah. It does not update/archive/reactivate/change lifecycle of existing profiles or create/link/invite accounts.
- Keep unexecuted batches active for 30 days, then make them read-only. Retain durable batch/revision/decision/result metadata according to audit retention; binary originals and generated correction/result files follow a configurable protected-storage retention policy that must be operationally configured before import activation.
- Store files in protected Tenant-scoped storage with encryption, content/malware checks, access control, and no generic payload logging.

### Delivery, migration, and rollout

- Deliver in order: shared foundation; Profil Sekolah and Tahun Ajaran; Mata Pelajaran and Rombongan Belajar; people without import; Sarana & Prasarana; Organisasi & Ekstrakurikuler; people import; `/master` overview.
- For each group, deploy additive schema, repository, domain commands, read UI/API, write UI/API, verification, and rollout as independently safe increments.
- Use expand/bootstrap-or-backfill/verify/activate/contract. Do not use destructive down migrations as routine rollback.
- Include explicit Tenant ownership and Tenant-aware uniqueness. Add strict constraints only after data verification proves compliance.
- Seed no sample production records. Bootstrap only authoritative facts with known provenance; do not infer the first Tahun Ajaran from the calendar.
- Separate read/write flags and import download/validation/execution flags. Feature-disabled server paths fail safely even if directly invoked.
- Advance through internal/demo, consenting Tenant pilot, import pilot, small cohort, and general activation based on completed evidence, not elapsed days.
- Immediately stop affected writes for suspected cross-Tenant access, unauthorized mutation, corrupted history, import double-commit, unexplained duplicate identity, destructive migration, or unreconciled data loss.
- Roll back by disabling the narrowest flag, stopping worker claims, and deploying schema-compatible application code. Use targeted idempotent repair for bad writes; reserve global restore for disaster recovery.

## Testing Decisions

- Tests assert external behavior at the highest practical seam and avoid coupling to internal function call order, ORM query shape, component markup details, or private helper structure.
- The primary seam is the domain command with an in-memory transaction-store adapter. These tests cover authorization ordering, validation, lifecycle transitions, duplicate decisions, archive blockers, idempotency, audit intent, and proof that failures cause no mutation.
- Real MySQL integration tests are mandatory for repository/query adapters, schema constraints, Tenant-aware uniqueness, composite ownership, transactions, row locking, optimistic concurrency, effective-dated overlap, atomic transfer, audit/outbox atomicity, import row commits, and retry markers.
- Follow existing command/store prior art used by Provider application approval, temporary credential activation, applicant submission, and Tenant onboarding tests.
- Follow existing conditional real-MySQL test prior art used by application approval and applicant submission. CI for this feature must provide MySQL rather than accepting skipped database tests as release evidence.
- Pure read-query tests cover normalization of search, archive scope, filters, sorting, page size, cursor/page state, and projection. Actual SQL scoping and joins are tested against MySQL rather than a mocked Drizzle chain.
- Thin route/server-action tests cover malformed transport input, canonical principal/identifier forwarding, authorization/error mapping, and non-disclosure of database errors. Domain permutations are not duplicated at this layer.
- Proxy/access integration tests prove host/domain rewriting, authenticated principal derivation, login redirection, matching Tenant success, role `403`, cross-Tenant `404`, and lifecycle/feature denial.
- Add Playwright for a small critical browser suite covering: School Admin access; non-admin/direct URL denial; cross-Tenant host and identifier manipulation; create/edit/conflict preservation; archive/reactivation blocker flow; mobile list/detail; one critical academic relationship flow; and complete import review/retry/result flow across two Tenants.
- Add automated axe checks to representative overview, list/detail, form error, confirmation, archive, read-only, and import review states. Perform manual keyboard, screen-reader, focus return, zoom/reflow, reduced-motion, contrast, and touch-target checks before rollout.
- Unit-test template parsing/version compatibility, formula rejection, row classification, exact/similar identity decisions, correction carry-forward, and aggregate result calculations without relying on spreadsheet UI.
- Test durable workers through a claim/process/checkpoint interface with injected failures. MySQL tests prove two workers cannot double-commit, restart skips success-marked rows, current authority/feature state is rechecked, and emergency stop prevents the next row claim.
- Test migration/bootstrap/repair commands in audit, apply, rerun, and verify modes. Rerun must be idempotent and ambiguous source data must fail closed.
- Reconciliation tests seed deliberate violations and assert detection of unknown Tenant ownership, cross-Tenant relationships, duplicate identifiers, overlapping periods, invalid active periods/memberships, archive misuse, missing audit/history, import success mismatch, duplicate success, accidental account creation, and overview count drift.
- Manual acceptance for every entity group covers first-use empty state, create, detail, edit, invalid input, successful save, stale conflict, search/filter/sort/page/deep link, browser back, responsive layout, all allowed/prohibited lifecycle transitions, archive blockers, archived read-only, reactivation, and Tenant lifecycle policy.
- Import manual acceptance includes valid rows, every hard identifier collision, exact existing-person profile attachment, similarity warnings, archived identities, invalid values, correction revision, skip, concurrent conflict, partial completion, worker restart, duplicate confirmation, result download, and reconciliation.
- Mocks are permitted for external services and deliberate fault injection, not as evidence for SQL correctness, Tenant isolation, transaction atomicity, storage contract, or durable retry.

## Out of Scope

- Master Data access for Tenant roles other than School Admin.
- Provider Admin profile-history/support UI; it requires a separate Provider-side authorization contract.
- Hard deletion of operational Master Data.
- Editing NPSN, official school name, domain, Provider education-level identity, or Tenant lifecycle from the Tenant workspace.
- Account creation, invitation, linking/unlinking, role assignment, or account deactivation from Master Data.
- Parent/guardian modeling.
- Merging Warga Sekolah records that were already created as duplicates.
- Bulk edit or bulk archive.
- Scheduled future Siswa/Guru/Staf status transitions.
- Guru education, certification, and employment-document histories.
- Tenant-managed catalogs for positions, employment types, religion, gender, or other closed structured values.
- Subject teaching assignments, curriculum delivery, teaching load, passing thresholds, timetables, or schedules.
- Downstream Absensi, Penjadwalan, PPDB, and Manajemen Pengguna features and any new blockers those future relationships require.
- Asset borrowing, reservation, assignment, maintenance work orders, accounting, or operational usage.
- Structured external extracurricular coach identities.
- Browser-based editing of spreadsheet cells.
- Import-based update, archive, reactivation, or lifecycle transition of an existing profile.
- Bulk import for Mata Pelajaran, Rombongan Belajar, Sarana & Prasarana, Organisasi, or Ekstrakurikuler.
- General export beyond import correction/result workbooks.
- External-system synchronization.
- Automatic profile geocoding.
- Permanent logo-version history beyond managed current-asset replacement and storage cleanup policy.
- User-configurable persisted table columns.

## Further Notes

- The canonical domain vocabulary is defined in the project glossary. In particular, Warga Sekolah is not an Akun Pengguna; a profile is not an authentication role; archive state is not a domain lifecycle status; and Rombongan Belajar is not a physical room.
- The latest cross-domain decisions supersede earlier ambiguous wording: Sarana & Prasarana remains separate from Organisasi & Ekstrakurikuler; stable codes remain reserved after archive; and authoritative provisioning values may be copied only with known provenance, never invented.
- The preserved import and UX prototypes are decision artifacts only. Production code must recreate the approved spreadsheet review and C-overview/B-workspace information architecture with real authorization, persistence, accessibility, responsive behavior, and tests.
- File-retention durations beyond the already decided 30-day active import-batch window are operational configuration. Import rollout is blocked until the deployment environment supplies and documents that policy; changing the duration does not alter domain identity or import transaction semantics.
- The specification intentionally establishes modules and interfaces rather than concrete file paths, allowing `/to-tickets` and implementation to place code consistently with the repository’s evolving structure.
