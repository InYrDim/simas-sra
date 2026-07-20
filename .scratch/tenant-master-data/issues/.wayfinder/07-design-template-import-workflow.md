# Design the people template import workflow

Type: prototype
Status: resolved
Blocked by: 04

## Question

What downloadable template format and end-to-end import experience should Siswa, Guru, and Staf use, including versioning, instructions, validation preview, duplicate matching, partial failure versus atomicity, correction, idempotent retry, authorization, and import-result reporting?

## Answer

### Chosen interaction model

- Use Variant B, **Review spreadsheet**, from the preserved prototype source at [`prototypes/people-import-variant-b-source.tsx`](../prototypes/people-import-variant-b-source.tsx).
- The main workspace is a dense, spreadsheet-like preview with row numbers, source values, normalized values where relevant, validation state, filters, search, and a contextual decision panel.
- Validation never writes Master Data. School Admin reviews the complete result before choosing which eligible rows to execute.
- The same workflow and vocabulary apply to Siswa, Guru, and Staf; only template columns, structured choices, and profile-specific validation differ.
- The page must remain usable without horizontal precision on small screens: mobile uses a row list and full-screen row detail/decision sheet rather than compressing the grid.

### Template contract

- Provide separate `.xlsx` templates for Siswa, Guru, and Staf. CSV is not an accepted first-release upload format because it cannot carry instructions, controlled reference values, or reliable identifier formatting in one artifact.
- Each workbook contains `Petunjuk`, `Data`, and protected `Referensi` sheets. `Data` has one header row and one example row that is clearly marked and ignored unless replaced.
- `Petunjuk` explains required and optional columns, examples, accepted date format (`YYYY-MM-DD`), identifier preservation, structured codes, maximum file limits, duplicate behavior, and the fact that import does not create Akun Pengguna.
- Identifier columns are formatted as text. Templates contain no macros, executable content, formulas, external links, hidden payload sheets, or embedded images.
- The workbook carries a machine-readable template kind and semantic version. The server detects these from workbook metadata and required headers, never from the filename.
- A template is accepted only for its matching entity type. The first release accepts the current major version and explicitly supported older major versions; an unsupported version is rejected before row validation with a link to download the current template.
- Additive optional columns increment the minor version and remain backward-compatible. Renamed, removed, reinterpreted, or newly required columns increment the major version.
- Upload limits are 10 MB and 5,000 data rows per workbook. Empty trailing rows do not count. Password-protected, corrupted, macro-enabled, or structurally ambiguous workbooks are rejected.
- Templates are generated from the current server contract so the instructions, reference codes, and validator cannot drift independently.

### Batch and revision lifecycle

- One upload creates a Tenant-scoped **Batch Impor Orang** with entity type, source-file identity, template version, initiating actor, timestamps, and immutable audit history.
- A batch progresses through `Diunggah`, `Divalidasi`, `Perlu Keputusan`, `Siap Dieksekusi`, `Sedang Dieksekusi`, and a terminal state of `Selesai`, `Selesai Sebagian`, `Gagal`, or `Dibatalkan`.
- Validation creates an immutable **Revisi Impor**. Uploading a corrected workbook to the same batch creates a new revision; it does not overwrite prior source values, validation results, or audit evidence.
- Only one revision is current and executable. Previous revisions remain readable but cannot be executed.
- A newly uploaded correction is matched to previous rows only for reviewer convenience. Decisions are carried forward only when the normalized identity-relevant fields and matched record have not changed; otherwise they must be reviewed again.
- Unexecuted batches expire from the active queue after 30 days and become read-only audit records. Expiration never changes Master Data.

### Parsing and validation

- Parsing treats all source cells as untrusted data. Formula cells are rejected rather than evaluated, and text that resembles a formula is preserved as text.
- Apply exactly the same normalization and domain validation used by manual creation, including Unicode names, whitespace cleanup, identifier text handling, dates, structured values, and Tenant-scoped uniqueness.
- Each row receives one state: `Siap`, `Peringatan`, or `Ditolak`. A row can expose multiple field-level findings with stable machine codes and localized explanations.
- `Ditolak` means the row cannot execute: required data is absent, a value is invalid, a hard identifier conflict exists, the target profile already exists, or a current domain rule fails.
- `Peringatan` means execution requires a School Admin decision, such as an unusual age or a possible Warga Sekolah match. Warnings are never silently accepted by a default bulk action.
- `Siap` means all current validations pass and no unresolved human decision remains; it is not a guarantee against a later concurrent conflict.
- The preview supports filters by state and problematic column, search by row/name/identifier, stable source-row numbering, and counts for all states. It must not display data from another Tenant in duplicate candidates or error text.

### Duplicate and identity decisions

- Hard conflicts use the identifier rules from the people record contract and are rejected. An identifier reserved by an archived profile points the reviewer to reactivation rather than permitting a replacement record.
- A possible person match opens a contextual comparison between the imported row and Tenant-local Warga Sekolah candidates, showing only fields necessary to decide.
- For each candidate warning, School Admin chooses exactly one outcome: `Tautkan ke Warga Sekolah dan tambah profil`, `Buat Warga Sekolah baru karena berbeda`, or `Lewati baris`.
- Linking is allowed only when the existing Warga Sekolah does not already have that profile type and all imported shared-person fields are compatible. Import does not silently overwrite shared Warga Sekolah fields; conflicting shared fields require correction outside the import or a new explicit decision supported by a future feature.
- `Buat baru karena berbeda` records the reviewed candidate identifiers and actor as audit evidence so retry does not ask again unless identity-relevant input changes.
- There is no automatic merge, fuzzy auto-link, or cross-Tenant candidate search.

### Partial execution and transaction boundary

- Variant B uses **reviewed partial execution**, not all-file atomicity. School Admin may execute all currently eligible `Siap` rows while `Ditolak` rows and explicitly skipped rows remain uncommitted.
- Every `Peringatan` row must have an explicit decision before it becomes eligible. The confirmation screen states exact counts to create, link, skip, and leave rejected.
- Execution freezes the selected revision and selected eligible row set. No row can be added to that execution after confirmation.
- Each selected row is atomic across Warga Sekolah, its Siswa/Guru/Staf profile, initial lifecycle record, and audit entries. A row either commits fully or writes no Master Data.
- The batch is not one database transaction: a concurrent conflict may fail one row without rolling back rows already committed. This yields `Selesai Sebagian` and a per-row failure result.
- Rows that were rejected, skipped, or failed remain available for export and correction. A later revision may execute only rows not already successfully applied.
- Import cannot update, archive, reactivate, or change lifecycle status of an existing profile in the first release. It creates a new Warga Sekolah plus profile or adds the imported profile to an explicitly matched Warga Sekolah.

### Concurrency and idempotent retry

- Revalidate authorization, Tenant lifecycle, template support, row validity, identifier uniqueness, matched-record eligibility, and selected decisions immediately before each row commit.
- An execution request has a server-issued idempotency key bound to Tenant, batch, revision, and selected row set. Repeating the request returns or resumes the same execution instead of creating another.
- Each source row has a stable row key derived from the batch/revision and source row identity. A durable success marker is written in the same transaction as its Master Data records.
- Worker retry skips rows with committed success markers, retries only rows without a terminal result, and never relies solely on file hashes or names for deduplication.
- Uploading the identical file may offer to reopen the existing unexecuted revision, but does not silently alias separate user intent. After any successful execution, a repeated upload still resolves identifiers against current data and cannot recreate committed profiles.
- A concurrent uniqueness or lifecycle change becomes a row-level failure with a fresh, actionable message; it never overwrites existing data.

### Correction workflow

- School Admin can download an `.xlsx` correction workbook containing source row number, original values, normalized values where useful, stable finding codes, human-readable messages, and blank correction columns.
- The correction workbook contains no unrelated Tenant records or duplicate-candidate personal data.
- Corrected data is uploaded as a new revision of the same batch. Direct cell editing inside the browser preview is out of scope for the first release; the preview is a review and decision surface, not an alternate data-entry grid.
- Rows can be skipped individually. A skip requires confirmation but no reason; the action and actor are audited. Skipped rows are not treated as failures.

### Authorization and security

- Apply the authorization boundary already defined for every template download, upload, validation, batch/revision read, candidate lookup, decision, correction download, confirmation, execution, retry, and result read.
- The batch Tenant comes only from the validated session/domain. Client-supplied Tenant identifiers, workbook Tenant values, record IDs, and candidate IDs never establish scope.
- Before execution and on worker resume, revalidate current School Admin authority and Tenant mutation state. Revoked authority or a read-only Tenant cancels pending execution without committing additional rows.
- Expired-trial tenants may download templates and read prior results but cannot upload or execute. Suspended tenants can only read prior results under the previously defined lifecycle policy and cannot download templates.
- Store the original workbook in protected Tenant-scoped storage with malware/content checks, encryption, strict access control, and retention policy. Never place cell payloads in application or security logs.

### Results and audit

- The terminal summary reports total source rows and separate counts for created profiles, linked profiles, skipped rows, validation-rejected rows, execution-failed rows, and unchanged/already-committed rows on retry.
- Every row exposes its source row number, terminal outcome, stable result code, explanation, resulting profile/Warga Sekolah link when authorized, and retry/correction eligibility.
- Provide downloadable result `.xlsx` using the same safe disclosure rules as the correction workbook.
- Batch history shows entity type, filename, template version, actor, upload/validation/execution times, revision count, status, and aggregate outcomes. School Admin can reopen every retained revision and execution result read-only.
- Audit records capture the batch, revision, execution, actor, Tenant, explicit duplicate decisions, selected row set, resulting record identities, and per-row outcome. They do not duplicate full sensitive cell payloads into generic audit logs.
- Importing never creates, links, invites, or assigns roles to Akun Pengguna; result messaging states this explicitly.

### Prototype disposition

- The prototype served as a decision artifact, not production implementation. The final implementation should reproduce Variant B's information hierarchy and behavior using production authorization, validation, persistence, accessibility, responsive, and testing standards rather than promoting the throwaway component directly.
