# Map current operations to permissions

Type: task
Status: resolved
Blocked by: 03, 07

## Question

After the canonical permission vocabulary is fixed, which current pages, server actions, route handlers, downloads, and domain operations require each permission, and which broad legacy checks must be split rather than translated one-for-one?

## Answer

### Decision and mapping rules

This is the implementation mapping for operations that exist in the current repository. Every key follows issue 03's stable English `<module>.<resource>.<action>` form, uses an admitted module root, names a business capability rather than a route, and is backed by a current server read, mutation, download, or export. Placeholder navigation does not create permissions.

Every mapped operation is authorized by the issue 06/07 conjunction:

`same Tenant AND active account/activation AND Tenant operational state AND feature entitlement (when applicable) AND exact permission AND contextual scope AND domain invariants`.

The tables abbreviate the invariant gates as follows:

- **T** — exact persisted Tenant membership, activated account, and current authoritative grants; never session role, menu state, URL state, or client input.
- **R** — Tenant readable/operational. Reads remain available in read-only/trial states only when the operational policy permits them.
- **W** — Tenant writable/operational; all mutations and import execution require this independently from permission.
- **MD** — Provider entitlement currently represented by `masterDataRead`, `masterDataWrite`, or the import-download entitlement as appropriate.
- **PPDB-R / PPDB-W** — current `ppdbRead` / `ppdbWrite` entitlement.
- **QUIZ-R / QUIZ-W** — current `ulanganRead` / `ulanganWrite` entitlement.
- **Tenant-wide** — same-Tenant query scope. It is not a custom-role bypass; where issue 07 has no safe narrower relationship, delegation is Tenant-wide or must remain School Admin-only.
- **Assigned** — current, effective, canonical assigned relationship. Class-and-subject scope requires one canonical teaching-assignment tuple. That tuple does not exist today, so such delegation must fail closed until it does.
- **Self** — explicit same-Tenant `school_person.accountUserId -> user.id`, never email, creator, role name, or profile type.
- **Transaction** — mutations must re-read actor authority, entitlement/state, Tenant-qualified target, contextual relationships, versions, and domain invariants inside the write transaction and atomically audit the change.

A page permission controls its server data load and navigation visibility; every action and handler also checks its own exact key. Dependencies are explicit registry metadata and persisted grants, not runtime inheritance. Thus an `update`, `archive`, `assign`, `execute`, `publish`, `decide`, `export`, or `view-sensitive` grant does not imply `view` unless both keys are assigned.

### Tenant, dashboard, users, and settings

| Canonical permission | Current real operation and entry points | Entitlement and context | Required split / sensitive distinction |
|---|---|---|---|
| `tenant.dashboard.view` | Dashboard load at `app/(tenant)/[domain]/(authenticated)/dashboard/page.tsx`, including `SessionInfo` and currently rendered summary shell | T + R; Tenant-wide | Replaces authenticated-layout-only access for the real dashboard. Placeholder analytics/activity skeletons do not create additional keys. |
| `tenant.onboarding.complete` | `completeOnboardingAction` -> `completeTenantOnboarding` in `dashboard/actions.ts` | T + W; School Admin system policy only; Transaction | Current `requireTenantFeatureAccess` implicitly means School Admin and names no capability. This one-time Tenant bootstrap is not a generic settings update. Classification: `school-admin-only`. |
| `tenant.users.view` | `/users` query of all same-Tenant `user` rows in `users/page.tsx` | T + R; Tenant-wide | Permits minimum directory identity/status only. It does not permit email or security state. |
| `tenant.users.view-contact` | Email projection currently rendered by `/users` | T + R; Tenant-wide | Supplemental contact projection. Without it, email must be omitted/masked. |
| `tenant.users.view-sensitive` | Legacy role and email-verification state currently rendered by `/users` | T + R; Tenant-wide | Supplemental security-state projection required to preserve the current real read exactly. It does not expose activation/credential artifacts, effective grants, or audit data. |
| `tenant-settings.landing-page.view` | `/settings` -> `getTenantLandingPageSettings` | T + R; Tenant-wide | Removes the unrelated master-data `read` check. |
| `tenant-settings.landing-page.update` | `updateLandingPageAction` -> `updateTenantLandingPage` | T + W; Tenant-wide; Transaction | Removes the unrelated broad master-data `write` check. HTML sanitization remains a domain/security invariant, not a permission. |

`dummyUpdateSettings` is demonstration code with no persisted business effect and receives no key. `PocTrialAction` is a trial/demo control rather than a Tenant RBAC business operation and receives no key in this catalog.

### School profile and institutional history

All current profile reads and mutations use `enforceMasterDataAccess`; they split as follows.

| Canonical permission | Current real operation and entry points | Entitlement and context | Required split / sensitive distinction |
|---|---|---|---|
| `school-profile.profile.view` | `/master/profil`; current profile query, accreditation/headmaster/logo history display | T + R + MD; Tenant-wide | Operational institution data only. Institutional phone/email, precise coordinates, certificate numbers, and protected asset metadata must be projected separately as sensitive where exposed. |
| `school-profile.profile.view-sensitive` | Sensitive profile/history fields already loaded on `/master/profil` (institutional contact, latitude/longitude, accreditation certificate details, protected asset metadata) | T + R + MD; Tenant-wide | Supplemental to `view`; omission/masking is enforced in server projections. It is not implied by update. |
| `school-profile.profile.update` | `updateSchoolProfileAction` -> `createUpdateSchoolProfileCommand` | T + W + MD; Tenant-wide; Transaction | Profile content only; does not grant headmaster assignment, accreditation correction, or file upload. |
| `school-profile.headmaster.assign` | `assignHeadmasterAction` -> headmaster assignment service | T + W + MD; Tenant-wide; Transaction | Explicit authority-changing domain assignment; current eligible teacher and effective-date invariants remain mandatory. |
| `school-profile.accreditations.create` | `addSchoolAccreditationAction` | T + W + MD; Tenant-wide; Transaction | Separate from profile update because it creates effective-dated institutional history. |
| `school-profile.accreditations.correct` | `correctSchoolAccreditationAction` | T + W + MD; Tenant-wide; Transaction | Corrections preserve old history and require reason/version/domain invariants; not ordinary update. |
| `school-profile.logo.upload` | `uploadSchoolLogoAction` -> protected file storage | T + W + MD; Tenant-wide; Transaction | File validation, storage root, Tenant-qualified key, retention, and old-file lifecycle remain independent invariants. |

### Academic years, subjects, and class groups

| Canonical permission | Current real operation and entry points | Entitlement and context | Required split / sensitive distinction |
|---|---|---|---|
| `academic-years.years.view` | `/master/tahun-ajaran`; year/semester list and detail | T + R + MD; Tenant-wide | Also supplies reference data to PPDB/quizzes only when the caller has that feature's own view permission; reference lookup must not become a bypass into the full academic-year workspace. |
| `academic-years.years.create` | `createAcademicYearAction`, `createAcademicYearQuickAction` | T + W + MD; Tenant-wide; Transaction | Manual and quick creation are the same capability. |
| `academic-years.years.manage-lifecycle` | `transitionAcademicYearAction` (`activate`/other declared transitions) | T + W + MD; Tenant-wide; Transaction | Explicit lifecycle permission; dates never transition state automatically. |
| `academic-years.years.archive` | Archive arm of `archiveAcademicYearAction` | T + W + MD; Tenant-wide; Transaction | Split from transition/update. |
| `academic-years.years.restore` | Reactivate arm of `archiveAcademicYearAction` | T + W + MD; Tenant-wide; Transaction | Separate restoration capability. |
| `subjects.subjects.view` | `/master/mapel`; subject catalog list/detail | T + R + MD; Tenant-wide | Subject reference selection in quiz creation may be exposed through a least-data reference query under quiz permissions; it must not imply full catalog access. |
| `subjects.subjects.create` | `createSubjectAction` | T + W + MD; Tenant-wide; Transaction | Education-level validation remains mandatory. |
| `subjects.subjects.update` | `editSubjectAction` | T + W + MD; Tenant-wide; Transaction | Does not include archive/restore. |
| `subjects.subjects.archive` | Archive arm of `archiveSubjectAction` | T + W + MD; Tenant-wide; Transaction | Relationship blockers remain enforced. |
| `subjects.subjects.restore` | Reactivate arm of `archiveSubjectAction` | T + W + MD; Tenant-wide; Transaction | Explicit restore. |
| `class-groups.groups.view` | `/master/rombel`; group list/detail and permitted membership/homeroom summaries | T + R + MD; Tenant-wide for administration; assigned subsets may be introduced only from current canonical homeroom/membership relationships | Group metadata view does not automatically expose full student/teacher sensitive data. |
| `class-groups.groups.create` | `createClassGroupAction` | T + W + MD; Tenant-wide; Transaction | Separate create. |
| `class-groups.groups.update` | `editClassGroupAction` | T + W + MD; Tenant-wide; Transaction | Separate ordinary field update. |
| `class-groups.groups.manage-lifecycle` | Transition arm of `manageClassGroupAction` (`activate`, `close`, `cancel`) | T + W + MD; Tenant-wide; Transaction | Split from archive and ordinary update. |
| `class-groups.groups.archive` | Archive arm of `manageClassGroupAction` | T + W + MD; Tenant-wide; Transaction | Relationship blockers apply. |
| `class-groups.groups.restore` | Reactivate arm of `manageClassGroupAction` | T + W + MD; Tenant-wide; Transaction | Explicit restore. |
| `class-groups.memberships.assign` | `addClassMembershipsAction`; `bulk-membership` and single-add arms of `manageClassRelationshipAction` | T + W + MD; Tenant-wide administrative scope; Transaction; atomic for bulk | Bulk and single placement share the same business capability; all targets must be current eligible same-Tenant students. |
| `class-groups.memberships.transfer` | Transfer arm of `manageClassRelationshipAction` | T + W + MD; Tenant-wide administrative scope; Transaction | Transfer atomically ends/starts relationships and is more sensitive than assign. |
| `class-groups.homerooms.assign` | Homeroom arm of `manageClassRelationshipAction` | T + W + MD; Tenant-wide administrative scope; Transaction | Establishes future contextual authority, so it is distinct from group update. |

There is no current unassign/end-homeroom entry point; no corresponding key is admitted yet.

### People, students, teachers, and staff

The three profile workspaces compose a Warga Sekolah identity with a Student/Teacher/Staff profile. Current pages expose identity/contact/government identifiers under one `read`, and current actions mutate both person and profile under one `write`. The target contract must check both applicable keys when one request performs both operations; it must not silently make a profile key authority over the shared person aggregate.

| Canonical permission | Current real operation and entry points | Entitlement and context | Required split / sensitive distinction |
|---|---|---|---|
| `people.people.view` | Shared Warga Sekolah minimum identity loaded by `/master/siswa`, `/master/guru`, `/master/staf`, detail aggregate queries, and eligible-person selectors | T + R + MD; Tenant-wide administration, Self where an explicit self-facing projection is later wired | Minimum identity only (for example stable ID/display name/status). |
| `people.people.view-contact` | Address, phone, email/contact fields already displayed by person/profile details | T + R + MD; same row scope as the containing operation | Supplemental projection; omission/masking required without it. |
| `people.people.view-sensitive` | NIK and other government/internal identity fields already loaded in the workspaces | T + R + MD; same row scope | Supplemental high-risk projection. Student NISN, teacher NUPTK, and employment identifiers likewise require the applicable profile `view-sensitive` key below. |
| `people.people.create` | Person creation performed as part of `createStudentAction`, `createTeacherAction`, and `createStaffAction` when no existing person is selected | T + W + MD; Tenant-wide; Transaction | Composite create requires this plus the applicable profile `.create`; selecting an existing person does not. |
| `people.people.update` | Shared identity edits performed by `editStudentAction`, `editTeacherAction`, and `editStaffAction` | T + W + MD; Tenant-wide or Self only if a future self-edit operation explicitly permits the fields; Transaction | Composite edit requires this plus the applicable profile `.update` when both aggregates change. |
| `people.people.archive` | `archiveSchoolPersonAction` | T + W + MD; Tenant-wide; Transaction | Only allowed when active profile/domain blockers permit it. Profile archive is not a substitute. |
| `students.students.view` | `/master/siswa` list/detail and student operational profile | T + R + MD; Tenant-wide administration; Assigned via current homeroom/class membership where an operation declares it; Self via account linkage | Minimum student fields only. Collection filtering happens in SQL before totals/search/pagination. |
| `students.students.view-sensitive` | NISN and sensitive student profile/identity fields currently displayed | T + R + MD; same contextual row scope | Supplemental projection, also requiring applicable `people.people.view-sensitive` for shared-person fields. |
| `students.students.create` | `createStudentAction` -> student service create | T + W + MD; Tenant-wide; Transaction | Requires `people.people.create` only when creating the shared person. |
| `students.students.update` | `editStudentAction` | T + W + MD; Tenant-wide; Transaction | Requires `people.people.update` when shared identity fields change. |
| `students.students.manage-lifecycle` | Transition and graduation-correction arms of `manageStudentLifecycleAction` | T + W + MD; Tenant-wide; Transaction | Graduation correction is intentionally lifecycle authority, not ordinary update. |
| `students.students.archive` | Archive arm of `manageStudentLifecycleAction` | T + W + MD; Tenant-wide; Transaction | Explicit archive. |
| `students.students.restore` | Reactivate arm of `manageStudentLifecycleAction` | T + W + MD; Tenant-wide; Transaction | Explicit restore. |
| `teachers.teachers.view` | `/master/guru` list/detail and teacher operational profile | T + R + MD; Tenant-wide administration; Self via account linkage | Minimum teacher fields only. |
| `teachers.teachers.view-sensitive` | NUPTK, internal teacher number, employment and other sensitive profile fields currently displayed | T + R + MD; same row scope | Supplemental to teacher view and applicable shared-person sensitive permission. |
| `teachers.teachers.create` | `createTeacherAction` | T + W + MD; Tenant-wide; Transaction | Composite person/profile rule applies. |
| `teachers.teachers.update` | `editTeacherAction` | T + W + MD; Tenant-wide; Transaction | Composite person/profile rule applies. |
| `teachers.teachers.manage-lifecycle` | Transition arm of `manageTeacherLifecycleAction` | T + W + MD; Tenant-wide; Transaction | Explicit lifecycle authority. |
| `teachers.teachers.archive` | Archive arm of `manageTeacherLifecycleAction` | T + W + MD; Tenant-wide; Transaction | Explicit archive. |
| `teachers.teachers.restore` | Reactivate arm of `manageTeacherLifecycleAction` | T + W + MD; Tenant-wide; Transaction | Explicit restore. |
| `staff.staff.view` | `/master/staf` list/detail and staff operational profile | T + R + MD; Tenant-wide administration; Self via account linkage; **not** free-text `workUnit` scope | Minimum staff fields only. Unit-scoped delegation fails closed until canonical unit identity/assignment exists. |
| `staff.staff.view-sensitive` | Internal employment/position details and sensitive profile fields currently displayed | T + R + MD; same row scope | Supplemental to staff view and applicable shared-person sensitive permission. |
| `staff.staff.create` | `createStaffAction` | T + W + MD; Tenant-wide; Transaction | Composite person/profile rule applies. |
| `staff.staff.update` | `editStaffAction` | T + W + MD; Tenant-wide; Transaction | Composite person/profile rule applies. |
| `staff.staff.manage-lifecycle` | Transition arm of `manageStaffLifecycleAction` | T + W + MD; Tenant-wide; Transaction | Explicit lifecycle authority. |
| `staff.staff.archive` | Archive arm of `manageStaffLifecycleAction` | T + W + MD; Tenant-wide; Transaction | Explicit archive. |
| `staff.staff.restore` | Reactivate arm of `manageStaffLifecycleAction` | T + W + MD; Tenant-wide; Transaction | Explicit restore. |

### People imports and generated workbooks

Imports are a distinct high-risk workflow. The current `read`, `write`, `validate-import`, `execute-import`, `download-template`, and feature-keyed `download` checks must not collapse to one `import` permission.

| Canonical permission | Current real operation and entry points | Entitlement and context | Required split / sensitive distinction |
|---|---|---|---|
| `people-imports.revisions.view` | `/master/import`, `/master/import/[revisionId]`, execution detail; `listImportRevisions`, `getImportReview`, `getPeopleImportExecution` | T + R + MD; Tenant-wide | Review rows may contain contact/government identifiers; those columns also require `people-imports.revisions.view-sensitive`. Creator ID is provenance, not ownership. |
| `people-imports.revisions.view-sensitive` | Sensitive values and candidate-match details in current import review/execution UI | T + R + MD; Tenant-wide | Supplemental projection; do not leak through validation errors, match candidates, counts, or generated files. |
| `people-imports.templates.download` | `GET /master/import/template/[kind]` -> `buildPeopleImportTemplate` | T + R + MD | Static template download; it does not grant upload, review, or export of Tenant data. |
| `people-imports.revisions.import` | Initial workbook `POST /master/import/upload` and correction workbook `POST /master/import/[revisionId]/revision`; parsing, protected storage, and revision creation | T + W + MD; Tenant-wide; Transaction | Covers ingestion/revision creation only. File size/type/content, protected path, Tenant-qualified storage key, cleanup, and revision lineage remain mandatory. |
| `people-imports.revisions.update` | `saveDecisionAction` -> `saveImportDecision` (link/create-distinct/skip) | T + W + MD; Tenant-wide; Transaction | Review decisions are separate from importing bytes and executing writes. |
| `people-imports.revisions.execute` | `executeImportAction` -> `confirmPeopleImportExecution`; demo import `importDemoMasterDataAction` -> `importDemoMasterData` | T + W + MD; Tenant-wide; Transaction; critical and atomic | Execution creates/changes real people/profile data. It must additionally validate that the role holds all destination operation keys needed by the selected import kind (people plus students/teachers/staff create/update as applicable), rather than letting import bypass domain permissions. Demo import is the same execution risk, not generic master-data write. |
| `people-imports.revisions.export` | Correction workbook `GET /master/import/[revisionId]/correction`; result workbook `GET /master/import/[revisionId]/execution/[executionId]/result` | T + R + MD plus current import-download entitlement; Tenant-wide | Bulk/generated Tenant data is `export`, not `download`. Requires sensitive projection authority when workbook content contains protected fields. Responses remain private/no-store and IDs are Tenant-qualified with concealed 404. |

### Facilities and assets

| Canonical permission | Current real operation and entry points | Entitlement and context | Required split / sensitive distinction |
|---|---|---|---|
| `facilities.locations.view` | `/master/sarpras`; location hierarchy, detail, blockers, and least-data location reference selectors | T + R + MD; Tenant-wide | Location reference use by another authorized aggregate may use a minimal reference projection, not full workspace authority. |
| `facilities.locations.create` | `createLocationAction` | T + W + MD; Tenant-wide; Transaction | Hierarchy/cycle invariants apply. |
| `facilities.locations.update` | `editLocationAction` | T + W + MD; Tenant-wide; Transaction | Does not include archive/restore. |
| `facilities.locations.archive` | Archive arm of `manageLocationAction` | T + W + MD; Tenant-wide; Transaction | All active relationship blockers remain enforced; no cascade. |
| `facilities.locations.restore` | Reactivate arm of `manageLocationAction` | T + W + MD; Tenant-wide; Transaction | Explicit restore. |
| `assets.assets.view` | `/master/sarpras/aset`; asset list/detail and inventory history | T + R + MD; Tenant-wide; no creator-based ownership | History is operational inventory history, not security audit. |
| `assets.assets.create` | `createAssetAction` | T + W + MD; Tenant-wide; Transaction | Separate create. |
| `assets.assets.update` | `editAssetAction` | T + W + MD; Tenant-wide; Transaction | Descriptive fields only. |
| `assets.inventory.adjust` | `changeInventoryAction` changing quantity, condition, location, and reason | T + W + MD; Tenant-wide; Transaction; sensitive | Explicit stock/custody adjustment; not ordinary asset update. |
| `assets.assets.archive` | Archive arm of `manageAssetAction` | T + W + MD; Tenant-wide; Transaction | Explicit archive. |
| `assets.assets.restore` | Reactivate arm of `manageAssetAction` | T + W + MD; Tenant-wide; Transaction | Explicit restore. |

### Student organizations and extracurriculars

| Canonical permission | Current real operation and entry points | Entitlement and context | Required split / sensitive distinction |
|---|---|---|---|
| `student-organizations.organizations.view` | `/master/organisasi`; organization, period, membership, leadership state | T + R + MD; Tenant-wide administration | Student identities shown in relationships still require minimum student/person projections. |
| `student-organizations.organizations.create` | `createOrganizationAction` | T + W + MD; Tenant-wide; Transaction | Separate identity creation. |
| `student-organizations.organizations.archive` | `archiveOrganizationAction` | T + W + MD; Tenant-wide; Transaction | Relationship blockers; no hidden cascade. No restore entry point exists today. |
| `student-organizations.periods.create` | `createPeriodAction` | T + W + MD; Tenant-wide; Transaction | Effective-dated period creation. |
| `student-organizations.periods.manage-lifecycle` | `transitionPeriodAction` (`activate`, `complete`) | T + W + MD; Tenant-wide; Transaction | Explicit lifecycle capability. |
| `student-organizations.periods.correct` | `correctPeriodAction` | T + W + MD; Tenant-wide; Transaction | Historical correction with reason/version is distinct from lifecycle. |
| `student-organizations.memberships.assign` | `addMembershipAction` | T + W + MD; Tenant-wide; Transaction | Current eligible same-Tenant student required. |
| `student-organizations.memberships.unassign` | `endMembershipAction` | T + W + MD; Tenant-wide; Transaction | Effective end, not deletion. |
| `student-organizations.leadership.assign` | `assignLeadershipAction` | T + W + MD; Tenant-wide; Transaction | Position/domain cardinality and effective dates apply. |
| `student-organizations.leadership.unassign` | `endLeadershipAction` | T + W + MD; Tenant-wide; Transaction | Effective end, not deletion. |
| `extracurriculars.extracurriculars.view` | `/master/organisasi/ekstrakurikuler`; extracurricular, group, advisor, participant state | T + R + MD; Tenant-wide administration; an advisor/participant self-facing operation would need an explicitly declared Assigned/Self arm | Current page is administrative and Tenant-wide. |
| `extracurriculars.extracurriculars.create` | `createExtracurricularAction` | T + W + MD; Tenant-wide; Transaction | Separate identity creation. |
| `extracurriculars.extracurriculars.archive` | `archiveExtracurricularAction` | T + W + MD; Tenant-wide; Transaction | Relationship blockers; no restore entry point exists today. |
| `extracurriculars.groups.create` | `createGroupAction` | T + W + MD; Tenant-wide; Transaction | Group belongs to current eligible extracurricular/year/location. |
| `extracurriculars.groups.manage-lifecycle` | `transitionGroupAction` (`activate`, `complete`, `cancel`) | T + W + MD; Tenant-wide; Transaction | Explicit lifecycle. |
| `extracurriculars.advisors.assign` | `assignAdvisorAction` | T + W + MD; Tenant-wide; Transaction | Teacher/staff eligibility and effective dates apply. |
| `extracurriculars.advisors.unassign` | `endAdvisorAction` | T + W + MD; Tenant-wide; Transaction | Effective end. |
| `extracurriculars.participants.assign` | `enrollParticipantAction` | T + W + MD; Tenant-wide; Transaction | Student eligibility/capacity/effective dates apply. |
| `extracurriculars.participants.unassign` | `endParticipantAction` | T + W + MD; Tenant-wide; Transaction | Effective end. |

### PPDB

All authenticated PPDB pages/layouts/actions require the named PPDB entitlement in addition to permission. Current pages inconsistently call broad master-data `read`; those calls must become PPDB permissions. Public applicant submission and public result checking remain outside Tenant RBAC, but Tenant publication settings determine what those public flows may reveal.

| Canonical permission | Current real operation and entry points | Entitlement and context | Required split / sensitive distinction |
|---|---|---|---|
| `ppdb.sessions.view` | `/ppdb/settings`, `/ppdb/riwayat`, `/ppdb/riwayat/[sessionId]`, `/ppdb/results` session metadata and reference lookups | T + R + PPDB-R; Tenant-wide | Does not grant applicant submissions, documents, or results. |
| `ppdb.sessions.create` | `createSessionAction` | T + W + PPDB-W; Tenant-wide; Transaction | Academic-year reference must be current and same Tenant. |
| `ppdb.sessions.update` | `updateFieldsAction`; `updateResultSettingsAction` | T + W + PPDB-W; Tenant-wide; Transaction | Form schema and result feedback/settings are editable configuration; publication and public-access toggles remain separate. |
| `ppdb.sessions.publish` | `publishSessionAction` | T + W + PPDB-W; Tenant-wide; Transaction | Publishes the public application form; explicit high-risk lifecycle action. |
| `ppdb.sessions.close` | `endSessionAction` | T + W + PPDB-W; Tenant-wide; Transaction | Ends intake; not generic update. |
| `ppdb.submissions.view` | `/ppdb` review list and `/ppdb/riwayat/[sessionId]` submission list/detail via submission service | T + R + PPDB-R; Tenant-wide | Minimum application fields only; collection query applies scope before counts/sort. |
| `ppdb.submissions.view-sensitive` | Applicant PII and sensitive application answers currently shown in review/history | T + R + PPDB-R; Tenant-wide | Supplemental server projection. |
| `ppdb.documents.view-sensitive` | `GET /ppdb/submissions/[submissionId]/documents/[documentId]` -> protected storage | T + R + PPDB-R; Tenant-wide; concealed 404 | Separate because uploaded documents are more sensitive than ordinary submission rows. Storage root/key and submission-document-Tenant linkage are revalidated server-side; no browser-provided path. |
| `ppdb.submissions.decide` | `decideSubmissionAction` accepting/rejecting and optionally scoring | T + W + PPDB-W; Tenant-wide; Transaction | Explicit decision authority; does not follow from update. |
| `ppdb.submissions.export` | `PrintSubmissionsDialog` / `submissions-list-printer.ts` printing the loaded applicant list | T + R + PPDB-R; Tenant-wide | Current export is client-generated from server-loaded rows, but the server query must require this key before returning the printable bulk projection. Also require `view-sensitive` for protected columns. No separate export API exists. |
| `ppdb.results.view` | `/ppdb/results` and result portions of PPDB history | T + R + PPDB-R; Tenant-wide | Administrative result view; public result check is outside Tenant RBAC. |
| `ppdb.results.publish` | `publishResultsAction` | T + W + PPDB-W; Tenant-wide; Transaction; critical | Makes decisions externally visible; independent of decide/update. |
| `ppdb.results.manage-access` | `updateResultCheckAccessAction` opening/closing public result checking | T + W + PPDB-W; Tenant-wide; Transaction; critical | Explicit public-disclosure control, not ordinary settings update. |

### Quizzes / Ulangan

Current Ulangan layout uses `ulanganRead`, but most pages then call broad master-data `read`; actions collapse all mutations into `ulanganWrite`. The target mapping is:

| Canonical permission | Current real operation and entry points | Entitlement and context | Required split / sensitive distinction |
|---|---|---|---|
| `quizzes.sessions.view` | `/ulangan`, `/ulangan/create` reference data, `/ulangan/[sessionId]`, `/ulangan/riwayat`, `/ulangan/riwayat/[sessionId]` session metadata/questions/attendance summaries | T + R + QUIZ-R; Tenant-wide administration or Assigned only through a current exact class+subject teaching tuple | The required teaching tuple does not exist today; non-School-Admin teacher delegation must fail closed until it exists. Minimal year/subject/class references are allowed under this operation without exposing their full admin workspaces. |
| `quizzes.sessions.create` | `createSessionAction` | T + W + QUIZ-W; Tenant-wide, or Assigned exact class+subject tuple when implemented; Transaction | Class, subject, year, and mode invariants apply. |
| `quizzes.sessions.publish` | `activateSessionAction` | T + W + QUIZ-W; same session scope; Transaction | Activates/publishes a session; separate from create/update. |
| `quizzes.sessions.close` | `endSessionAction`, including optional fill-missing-absent behavior | T + W + QUIZ-W; same session scope; Transaction | Closing and attendance completion are atomic lifecycle work. |
| `quizzes.questions.view` | Question list/detail rendered on active/history/grading pages | T + R + QUIZ-R; same session scope | Correct answers must be omitted from participants and from any projection lacking `quizzes.questions.view-sensitive`. |
| `quizzes.questions.view-sensitive` | Correct answers and grading material currently loaded for management/history | T + R + QUIZ-R; same session scope | Supplemental sensitive projection. |
| `quizzes.questions.create` | `addQuestionAction`, `addDemoQuestionsAction` | T + W + QUIZ-W; same session scope; Transaction | Demo insertion is the same real question-creation capability. |
| `quizzes.questions.update` | No current entry point | — | **No key admitted now.** Add only with a real server mutation. |
| `quizzes.questions.remove` | `removeQuestionAction` (domain operation removes a question from the mutable session) | T + W + QUIZ-W; same session scope; Transaction | This is a specific destructive business action, not `archive`: the current operation removes a mutable question and exposes no archive/restore lifecycle. Implementation must preserve required audit/history semantics. |
| `quizzes.attendance.view` | Attendance list/summary on `/ulangan/[sessionId]`, `/absensi`, and history pages | T + R + QUIZ-R; same session/class scope | `/ulangan/[sessionId]/absensi` is the real feature page; top-level `/absensi` is currently only a placeholder and gets no separate key. |
| `quizzes.attendance.adjust` | `saveAttendanceBatchAction`, `markAttendanceAction`, and close-session fill-missing attendance arm | T + W + QUIZ-W; same session/class scope; Transaction; batch atomic | Attendance changes are explicit adjustments, not session update. Closing additionally requires `quizzes.sessions.close`. |
| `quizzes.grades.view` | Answer sheets/scores on grading and history pages | T + R + QUIZ-R; same exact session scope | Student result rows are sensitive educational records and are omitted without this key. |
| `quizzes.grades.adjust` | `saveOfflineScoresAction` | T + W + QUIZ-W; same session scope; Transaction; batch atomic | Manual score changes are explicit sensitive adjustments. |
| `quizzes.grades.execute` | `prepareOfflineGradingAction`, `finalizeOfflineGradingAction`, `gradeSessionAction` | T + W + QUIZ-W; same session scope; Transaction | Runs/finalizes grading workflow; separate from manual adjustment. Domain state decides which of the three transitions is valid. |

### Navigation and page composition

`TenantNavMenu` must stop using singular legacy role arrays as authority. It should derive visibility from the same effective permission snapshot used for the request, while remaining presentation only:

- Dashboard -> `tenant.dashboard.view`.
- Users -> `tenant.users.view` (email column additionally `tenant.users.view-contact`).
- Settings -> `tenant-settings.landing-page.view`.
- Master overview -> visible when the principal has at least one mapped master-data view permission; the overview query returns only authorized module counts and must not use one broad synthetic permission.
- Import -> `people-imports.revisions.view`; template/import/export controls use their exact keys.
- Each master-data child -> its resource `.view`; action controls use exact create/update/lifecycle/assignment keys.
- PPDB group -> PPDB entitlement plus any relevant `ppdb.*.view`; child controls use exact PPDB keys.
- Ulangan group -> Ulangan entitlement plus a relevant `quizzes.*.view`; child controls use exact quiz keys.

Page layouts may preflight the least capability needed to render a subtree, but they do not replace checks in server actions, route handlers, protected-file reads, generated downloads, print/export data queries, or domain commands. A page that combines resources checks each query/projection independently rather than granting all data because one tab is visible.

### Broad legacy checks that must be split

1. `enforceMasterDataAccess(domain, "read")` is not translated to one `master-data.read` key. It splits into the resource `view`, supplemental `view-contact`/`view-sensitive`, feature-specific PPDB/quiz reads, settings view, and import review permissions above.
2. `enforceMasterDataAccess(domain, "write")` is not translated to one `master-data.write` key. It splits create, update, archive, restore, lifecycle, assignment, correction, inventory adjustment, upload, import execution, publication, decision, grading, and settings operations.
3. `download-template` maps only to `people-imports.templates.download`; correction and result workbooks are Tenant-data bulk `export`, not template downloads.
4. `validate-import` splits ingestion/revision creation (`import`) from review decisions (`update`); `execute-import` remains a critical `execute` and also validates destination-resource permissions.
5. `ppdbRead`/`ppdbWrite` and `ulanganRead`/`ulanganWrite` remain entitlements/operational feature gates, never Permission Tenant keys. They compose with the exact `ppdb.*` or `quizzes.*` permission.
6. `requireTenantFeatureAccess` and `tenantProtectedAction` are activation/trial wrappers, not capability checks. Onboarding receives its exact School-Admin-only permission; demonstration operations receive none.
7. `principal.capabilities.write` may remain a temporary UI aggregate during migration only. It cannot authorize controls after RBAC; each control uses the exact effective permission.
8. `tenantRole === "school-admin"`, navigation `roles`, and the master-data principal's fixed School Admin role are migration inputs only. School Admin system policy may resolve all applicable keys and Tenant-wide context, but custom role names never do.

### Surfaces explicitly outside Tenant RBAC

- Provider pages/actions/queries, Provider Admin access, Provider feature configuration, Tenant approval/provisioning, School Admin lifecycle/reset, Provider audit/support/billing/impersonation, and Provider-side Tenant lists remain the separate Provider authorization context.
- Auth and central identity flows (`login`, `continue`, required password change, forgot/reset password, registration), Better Auth handlers, applicant identity, and account activation are authentication/lifecycle policy, not assignable Tenant permissions.
- Public Tenant landing page reads, public PPDB application submission/upload, and public PPDB result checking are anonymous/applicant policies. Tenant RBAC governs only authenticated administration and the publish/access mutations that expose data publicly.
- Tenant/domain resolution, exact Tenant membership, account activation, operational/trial state, Provider entitlements, contextual relationships, optimistic concurrency, file validation/retention, and domain invariants are mandatory independent gates—not permission keys.
- Provider-owned School Admin status remains system policy and is not a Tenant-managed role. The target Tenant RBAC and non-admin account lifecycle keys specified below are reserved `school-admin-only` contract entries; they become admitted registry entries only when each real endpoint, evaluator call, transactional enforcement, audit behavior, and tests ships with it.
- Placeholder-only authenticated pages currently backed by no domain read or mutation—top-level `/absensi`, `/e-library`, `/persuratan`, `/jadwal/mengajar`, `/jadwal/events`, `/settings/backup-restore`, and the empty WhatsApp Bot page—receive no permission key. Existing menu entries do not justify catalog entries.
- Local dashboard role-switch/demo state, static skeleton analytics/activity, and client-only presentation helpers are not authorization surfaces.

### Exhaustive legacy-role equivalence and frozen migration grants

This section is normative for issue 11. It partitions **every current mapped permission and every current Tenant surface** into deterministic equivalence classes. The five non-admin values are intentionally identical because current server authority never distinguishes `pimpinan`, `staff`, `guru`, `siswa`, and `guest` after the authenticated layout: profile names and menu labels are not authority.

#### Legacy evidence and decision function

For a recognized non-admin legacy user with exact Tenant membership:

1. `enforceTenantPageAccess` and the authenticated layout admit all recognized `TenantRole` values. This is only the Tenant routing/membership boundary.
2. `authorizeMasterDataAccess` returns `{ kind: "forbidden", reason: "role" }` unless persisted `tenantRole === "school-admin"`. This guards every mapped master-data read/write, settings page/action, PPDB/Ulangan page data query, import flow, and template handler.
3. `enforceTenantFeatureAccess` delegates through the same School-Admin-shaped master-data principal; named feature entitlement does not grant a non-admin operation.
4. `requireTenantFeatureAccess` calls `requireActivatedTenantPrincipal`, whose principal is structurally `tenantRole: "school-admin"`; therefore onboarding and `tenantProtectedAction` deny every non-admin role.
5. The only current real business read after the layout that does **not** invoke a School Admin guard is `/users`: it runs `enforceTenantPageAccess`, then reads every same-Tenant user and renders name, email, legacy role, and email-verification status. The dashboard shell also loads after layout without an operation guard. Placeholder pages render static text only and are not permissions.
6. `TenantNavMenu` marks dashboard, users, Ulangan, and several placeholders with `roles: ["*"]`, but Ulangan's server layout/data guards still deny all non-admin roles. Navigation is evidence of visibility only and cannot create a legacy allow.

Define these complete sets over the canonical keys in this answer:

- **L0 — membership-only real operations:** `{ tenant.dashboard.view, tenant.users.view, tenant.users.view-contact, tenant.users.view-sensitive }`.
- **L1 — all other current-operation keys:** every canonical key in the current-operation tables above except L0. This includes every profile projection, master-data/reference read, mutation, assignment, lifecycle command, import/upload/download/export, protected document, PPDB operation, quiz operation, settings operation, and `tenant.onboarding.complete`.
- **L2 — no-key surfaces:** authenticated layout/sidebar/header/trial banner; static `/absensi`, `/e-library`, `/persuratan`, `/jadwal/mengajar`, `/jadwal/events`, `/settings/backup-restore`, and empty WhatsApp page; `dummyUpdateSettings`, `PocTrialAction`, skeleton analytics/activity, and client-local role demo state. L2 has no Permission Tenant entries and therefore never contributes a migration grant.
- **L3 — outside Tenant RBAC:** Provider, auth/account-owned ceremonies, applicant/public PPDB, and public landing-page reads enumerated above. L3 is excluded from migration-role permission sets.

The partition is exhaustive and deterministic: each current mapped key is in exactly L0 or L1; every reviewed Tenant surface without a key is in L2 or L3. A new or renamed key is denied for all frozen migration roles until this partition and issue 11's pinned map version are explicitly revised and equivalence is rerun.

#### Per-role exhaustive matrix

`Allow` below means only that the legacy role currently reaches the operation after the same T/R/W, entitlement, context, projection, and domain-invariant gates. `Deny` includes absence of server authority even when a menu item is visible.

| Legacy role | L0 dashboard/minimum user directory/contact/security projection | L1 every other mapped operation/projection/context/surface | L2 no-key surfaces | Frozen migration-role permission set | Legacy evidence |
|---|---|---|---|---|---|
| `pimpinan` | **Allow**, Tenant-wide same-Tenant projection | **Deny** for every key | Membership may render static UI; **no permission** | Exactly L0: `tenant.dashboard.view`, `tenant.users.view`, `tenant.users.view-contact`, `tenant.users.view-sensitive` | Recognized by layout; `/users` and dashboard lack operation guard; exact-role School Admin guards deny L1 |
| `staff` | **Allow**, Tenant-wide same-Tenant projection | **Deny** for every key | Membership may render static UI; **no permission** | Exactly L0: `tenant.dashboard.view`, `tenant.users.view`, `tenant.users.view-contact`, `tenant.users.view-sensitive` | Same code path; no `staff` authorization branch exists |
| `guru` | **Allow**, Tenant-wide same-Tenant projection | **Deny** for every key, including Assigned/Self quiz or people access | Membership may render static UI; **no permission** | Exactly L0: `tenant.dashboard.view`, `tenant.users.view`, `tenant.users.view-contact`, `tenant.users.view-sensitive` | No profile-derived grant; missing teaching tuple cannot be approximated; School Admin guards deny L1 |
| `siswa` | **Allow**, Tenant-wide same-Tenant projection | **Deny** for every key, including Self student/grade access | Membership may render static UI; **no permission** | Exactly L0: `tenant.dashboard.view`, `tenant.users.view`, `tenant.users.view-contact`, `tenant.users.view-sensitive` | No self-service operation/evaluator exists today; profile linkage grants nothing |
| `guest` | **Allow**, Tenant-wide same-Tenant projection | **Deny** for every key | Membership may render static UI; **no permission** | Exactly L0: `tenant.dashboard.view`, `tenant.users.view`, `tenant.users.view-contact`, `tenant.users.view-sensitive` | Recognized by layout; no guest-specific server branch exists |

The current `/users` behavior is overbroad but real: zero-widening requires preserving its name/email/legacy-role/verification read at cutover, represented explicitly by L0's minimum-directory, contact, and sensitive keys. Migration must not silently remove any of those projections from the legacy-equivalence test. The frozen roles contain no wildcard, template-derived, profile-derived, Assigned, Self, mutation, sensitive-person, export, or future-operation grants.

For issue 11 verification, expand the set notation mechanically into tuples `(legacy role, canonical key, surface, context, projection)`: every L0 tuple is expected `legacy=allow`; every L1 tuple is expected `legacy=deny`; L2 emits no tuple; L3 is evaluated by its separate policy. RBAC may cut over only with zero `legacy=deny / RBAC=allow` tuples. Unknown keys default to L1/deny, which proves no widening when the registry evolves.

### Target-operation authorization contract: RBAC administration and account lifecycle

These are exact reserved canonical keys for target operations required by the RBAC design. They use issue 03's existing `tenant` module root and are all classified **`school-admin-only`**: they are effective only through Provider-owned School Admin system policy, absent from custom-role selection, rejected in custom-role permission writes, and never obtained by copying/renaming a role. They are not migration grants for any non-admin legacy role.

Issue 03's catalog-admission rule remains controlling: a reserved key below becomes an admitted/active registry entry only in the same release that ships its real server endpoint or command, direct centralized evaluator enforcement, transactional revalidation/audit where applicable, denial/concealment behavior, and positive/negative/cross-Tenant/concurrency tests. Until that bundle exists, the key is reserved documentation, unknown to runtime, and fails closed.

#### Role lifecycle

| Canonical key | Exact target operation | Enforcement contract |
|---|---|---|
| `tenant.roles.list` | List same-Tenant roles with minimum lifecycle/assignment summary | Same Tenant; School Admin; collection query is Tenant-qualified before counts/pagination; permission catalog metadata itself is code-owned |
| `tenant.roles.view` | View one role's state, version, assignability, permission composition, dependencies, and impact | Same Tenant; School Admin; omit cross-Tenant existence with concealed not-found behavior |
| `tenant.roles.create` | Create a new draft custom role | Transaction; reserved-name validation; no `school-admin-only`/internal/unknown keys |
| `tenant.roles.copy` | Copy an eligible role into a new draft role | Revalidate source visibility and current registry; copy never carries system identity or bypass |
| `tenant.roles.rename` | Rename a custom role without changing grants | Versioned transaction; names have no authorization meaning |
| `tenant.roles.change-permissions` | Replace a draft role's complete permission set | Validate exact known active keys, dependencies, assignment classification, version, and impact; atomic audit |
| `tenant.roles.activate` | Activate a valid draft role | Revalidate dependencies/catalog/version and role invariants in transaction |
| `tenant.roles.draft` | Return an eligible role to draft/inactive editing state | Revalidate assignment/impact policy; next request observes removed grants |
| `tenant.roles.archive` | Archive an eligible custom role | Revalidate assignments, lockout/impact, version, and audit; no hard delete |
| `tenant.roles.restore` | Restore an archived eligible role to the lifecycle state defined by issue 04 | Restore grants nothing until valid activation/assignment rules pass; versioned audit |

#### Assignments, effective access, and authorization audit

| Canonical key | Exact target operation | Enforcement contract |
|---|---|---|
| `tenant.assignments.view` | List/view user-role assignments and assignment impact | Same Tenant; conceal foreign users/roles; no mutation authority |
| `tenant.assignments.replace` | Atomically replace one user's complete custom-role assignment set | Re-read actor, target, roles, versions, eligibility, and lockout invariants; never manage School Admin membership |
| `tenant.assignments.bulk` | Atomically replace assignments for multiple users | All-or-nothing; every target and role same Tenant/current/eligible; bounded input and impact confirmation |
| `tenant.effective-access.view` | Explain one same-Tenant user's effective keys, role sources, and contextual limitations | Security-sensitive projection; never expose foreign-Tenant state or turn explanation into authority |
| `tenant.authorization-audit.view` | View authorization/role/assignment/account-lifecycle audit events | Tenant-qualified query and retention policy; security-sensitive fields projected minimally |
| `tenant.authorization-audit.export` | Export authorization audit events | Separate bulk export; bounded filters, private/no-store delivery, audit the export itself |

#### Non-admin account lifecycle

These commands manage ordinary Tenant accounts only. Every command must reject a target with Provider-owned School Admin authority, Provider Admin/applicant identity conflict, foreign Tenant membership, or ambiguous identity. Provider exclusively owns School Admin creation, transfer, suspension/removal, and temporary-credential lifecycle.

| Canonical key | Exact target operation | Enforcement contract |
|---|---|---|
| `tenant.accounts.create` | Create an inactive/pending ordinary Tenant account record | Transaction; same-Tenant identity uniqueness; no implicit profile link, role, invitation, or credential |
| `tenant.accounts.invite` | Issue the first invitation/activation ceremony for an eligible ordinary account | Revalidate account state and delivery destination; one-time/expiring token; rate-limit and audit |
| `tenant.accounts.link` | Link an ordinary account to an eligible same-Tenant Warga Sekolah | Transaction; explicit target/profile identity; uniqueness and ambiguity checks; linking grants no role |
| `tenant.accounts.unlink` | Remove the account-to-Warga Sekolah link | Transaction; impact preview; does not delete person/account or preserve Self scope |
| `tenant.accounts.resend` | Idempotently redeliver the same still-valid activation material for the same invitation/case | Revalidate pending state and safe redelivery availability; preserve the exact token digest, expiry, invitation/case identity, account version, and activation state; do not rotate, invalidate, revoke sessions, extend expiry, create replacement material, or emit duplicate audit on delivery retry. A successful logical resend records exactly `tenant_account.invitation_resent` plus delivery-attempt metadata under the idempotent delivery key. Expired, consumed, superseded, revoked, unavailable-for-safe-redelivery, or otherwise invalid material rejects without mutation and requires separate `tenant.accounts.reissue`, whose successful security mutation revokes/replaces prior material and records `tenant_account.activation_reissued` |
| `tenant.accounts.reissue` | Reissue a lapsed/revoked ordinary-account invitation or activation artifact | Reauthenticate School Admin as required; revoke prior artifacts/sessions according to policy; one-time secret handling |
| `tenant.accounts.deactivate` | Deactivate an ordinary Tenant account | Transactionally revoke sessions/effective use and preserve assignments as suspended history per issue 05; cannot violate recovery/lockout policy |
| `tenant.accounts.reactivate` | Reactivate an eligible ordinary Tenant account | Does not silently restore invalid roles/context; revalidate current assignments and account/profile state |
| `tenant.accounts.initiate-recovery` | School Admin initiates the approved recovery flow for an ordinary account | Does not set/read a password; emits short-lived single-use recovery ceremony, revokes as policy requires, rate-limits, and audits without secrets |

The requested “recovery-initiation” capability is canonically `tenant.accounts.initiate-recovery`, using issue 03's action-first business vocabulary rather than a noun phrase. Likewise, the role permission operation is `tenant.roles.change-permissions` (not broad `update`), and complete assignment replacement/bulk operations remain distinct.

User-owned authentication ceremonies remain outside Tenant RBAC: signing in/out, changing one's own password, completing an invitation/activation, verifying email, requesting/consuming ordinary forgot-password recovery, MFA/passkey enrollment and challenge, and session management are authorized by authentication protocol, possession/reauthentication, token state, and abuse controls. The School Admin `invite`, `resend`, `reissue`, and `initiate-recovery` commands only initiate lifecycle ceremonies for eligible ordinary same-Tenant accounts; they never let the actor choose credentials, consume the ceremony, read secrets/hashes, or bypass Better Auth. Provider-owned School Admin credential reset/reissue remains outside Tenant RBAC.

### Coverage and evidence

The mapping was produced from an exhaustive current-surface pass over:

- all 102 TypeScript/TSX files under `monorepo/app/(tenant)`, including every authenticated `page.tsx`, `layout.tsx`, server-action module, and route handler;
- all authenticated Tenant action/handler exports and all call sites of `enforceMasterDataAccess`, `enforceTenantFeatureAccess`, `requireTenantFeatureAccess`, and `tenantProtectedAction`;
- the six authenticated Tenant file/download/import handlers: import template, upload, correction revision upload, correction workbook, execution result workbook, and PPDB protected-document read;
- current domain service calls for academic years, subjects, classes/memberships/homerooms, shared people and student/teacher/staff profiles, school profile/history/assets, imports, facilities/assets, organizations/extracurriculars, PPDB, quizzes/attendance/grading, dashboard onboarding, users, and landing-page settings;
- `components/tenant-nav-menu/config.ts`, including every role/feature-filtered navigation entry; and
- resolved issues 02, 03, 06, and 07 plus `map.md`, preserving their naming, catalog-admission, evaluator, concealment, contextual-scope, sensitive-projection, export, freshness, and transactional-revalidation decisions.

Concrete evidence of present mismatches includes: `/users` exposing all Tenant emails after membership-only enforcement; settings and feature pages using master-data checks; PPDB and Ulangan pages using master-data `read` after feature layouts; all mutations in each feature sharing one broad write capability; import downloads mixing operation names and entitlement keys; current menu authorization using singular roles; and placeholder pages being visible without server-backed operations. This answer deliberately maps those real operations without inventing permissions for unfinished features.
