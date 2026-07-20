# Specify the School Profile contract

Type: grilling
Status: resolved
Blocked by: 01, 02

## Question

Which Profil Sekolah fields are displayed, editable, required, validated, and auditable; how are logo and address represented; and how does the page preserve NPSN as a read-only Provider-governed identity while permitting School Admin to manage all other agreed profile attributes?

## Answer

### Ownership and lifecycle

- Every Tenant has exactly one Profil Sekolah, created automatically when the Tenant is provided. It is not created, archived, reactivated, or deleted independently.
- Profil Sekolah contains School Admin-managed operational attributes. It does not duplicate Provider-governed Tenant identity.
- Tenant lifecycle controls editability according to the established School Admin authorization contract. In a read-only state, the profile and its history remain visible, but every mutation—including logo, address, contacts, headmaster assignment, and accreditation—is denied by the server.
- Profil Sekolah may be `Belum Lengkap` or `Lengkap`. Existing or migrated profiles may be saved incrementally while incomplete, but supplied values must always be valid. Incompleteness does not block other Master Data areas in the first release.

### Provider-governed identity

- NPSN, Nama Resmi Sekolah, education level, and domain appear together under `Identitas Resmi` as clearly read-only values sourced directly from the Provider-controlled Tenant record.
- These attributes are absent from editable controls and the accepted mutation schema. A request containing any Provider-governed field is invalid and rejected even when the supplied value equals the current value.
- Nama Resmi Sekolah is the legal or administrative identity. Nama Tampilan Sekolah is a distinct operational name editable by School Admin and used throughout the Tenant UI.
- The page explains that official identity is Provider-managed and offers `Ajukan koreksi identitas`. This opens a support/correction channel with Tenant and NPSN context; it never mutates the Tenant directly or form part of a Profil Sekolah update.

### Initialization

- When a Tenant is provided from a Pengajuan SIMAS, Nama Tampilan Sekolah is initialized from Nama Resmi Sekolah. Address and institutional school contacts may also be copied once as initial profile values.
- An applicant's email or WhatsApp is copied only when it is known to be an institutional school contact. Personal applicant contact data is not automatically published; unknown contact fields remain empty.
- Pengajuan SIMAS remains an immutable historical snapshot. Later Profil Sekolah changes do not update it.

### Displayed and editable profile fields

The page displays and permits School Admin to edit:

- Nama Tampilan Sekolah.
- Logo sekolah.
- Structured address.
- Primary school email and optional secondary email.
- Primary school telephone/WhatsApp and optional secondary number, with a classification of telephone, WhatsApp, or both; telephone extensions are separate values.
- Optional HTTPS website.
- Optional school coordinates.
- Optional plain-text short description.

The page additionally displays and manages, through separate history-aware operations:

- The current and historical headmaster assignments.
- The current and historical accreditation records.

### Completeness requirements

A Profil Sekolah is `Lengkap` only when it has:

- A valid Nama Tampilan Sekolah.
- Province, regency/city, district, and village/subdistrict selections.
- Street/hamlet and number or other sufficient location detail.
- A valid postal code.
- At least one valid primary institutional contact: email or telephone/WhatsApp.

Logo, secondary contacts, website, headmaster assignment, accreditation, coordinates, and description are optional for base profile completeness. The UI identifies every missing requirement and shows the current completeness state.

### Address contract

- Administrative regions form a hierarchy: province → regency/city → district → village/subdistrict.
- Each region is selected from an official reference dataset and represented by its official code and display label, not unconstrained text.
- Street/hamlet, number or location detail, RT, RW, postal code, and location notes are separate fields. A rendered full-address string is derived for display and is not the source of truth.
- A retired or changed region reference does not silently remap an existing address. The saved address remains displayable and is flagged for School Admin review.
- RT and RW are optional, accept one to three digits, and are normalized to three digits for display. Postal code is exactly five digits.
- Street/hamlet detail is 1–255 characters when supplied as required address detail; optional location notes are at most 500 characters.

### Logo contract

- A logo is a Tenant-owned managed asset. Profil Sekolah references the active asset identity rather than storing a free-form URL or image data.
- Accepted source formats are PNG, JPEG, and WebP, with a maximum source size of 2 MB and minimum dimensions of 256 × 256 pixels.
- The output is square. A non-square upload requires School Admin to choose a square crop before saving.
- The server validates the actual file content rather than trusting its extension or declared MIME type and produces optimized delivery variants. Raw originals are not served directly to users.
- Replacing or removing a logo is audited. Unreferenced old assets may be removed after an operational grace period; permanent visual version history is not required.
- Without a logo, the UI uses a neutral placeholder or school initials, never the Provider logo.

### Headmaster assignment

- Headmaster is an effective-dated assignment to an active Guru profile, not free text copied into Profil Sekolah.
- The assignment requires a start date, supports an end date, preserves history, and permits at most one active headmaster at a time.
- A Guru with an active headmaster assignment cannot be archived until the assignment is ended.
- The profile remains valid without a headmaster assignment; the UI indicates that none is assigned.

### Accreditation

- Accreditation is an effective historical record rather than a single overwritten profile field.
- Each record includes rating (`A`, `B`, `C`, `Terakreditasi`, or `Tidak Terakreditasi`), decision/certificate number, issuing institution, determination date, optional expiry date, and an optional managed certificate asset.
- At most one accreditation record is current at a time. Historical entries remain readable and are never hard-deleted; an erroneous entry is superseded or invalidated with a reason.
- Issuing institution is at most 150 characters and decision/certificate number at most 100 characters.

### Contact, URL, coordinate, and text validation

- Email is trimmed, normalized to lowercase, validated as an email address, and limited to 254 characters.
- Indonesian local telephone input is normalized to E.164 storage, such as `0812…` to `+62812…`; an extension is stored separately. Each number is explicitly classified as telephone, WhatsApp, or both.
- Email addresses and telephone numbers are not globally or cross-Tenant unique.
- Website is optional and must use HTTPS outside local development.
- Coordinates are optional numeric latitude and longitude values. Both must be supplied together; latitude must be in `-90..90` and longitude in `-180..180`.
- Coordinates may be selected on a map or entered directly. They are not stored as a third-party map URL. Changing the address warns that coordinates may need review but never silently moves the point. Automatic geocoding is outside the first release.
- Nama Tampilan Sekolah is 2–150 characters and need not be unique across Tenants. Description is plain text of at most 1,000 characters; rich text and HTML are not accepted.
- Inputs are trimmed, meaningless repeated whitespace and control characters are removed, original meaningful capitalization is retained, and empty optional values are stored as null rather than empty strings.
- Server validation is authoritative and matches the constraints presented by the UI.

### Audit and history

- Every successful save records Tenant, actor, timestamp, operation, affected profile, changed fields, and before/after values.
- Address changes are recorded by component rather than only as a derived full-address string. Logo changes record old and new asset identities, not file contents.
- Headmaster assignments and accreditation maintain their own append-only effective histories.
- School Admin can read the Tenant's profile history. Provider Admin may read it under Provider support and oversight authority. School Admin cannot edit audit records.
- Attempts to mutate Provider-governed identity are rejected and recorded as security events without retaining sensitive payloads.

### Save and concurrency behavior

- Ordinary editable profile fields, address, contacts, and the active logo reference are validated and committed atomically as one profile update.
- Headmaster assignment and accreditation changes use separate operations because each has an independent lifecycle and history.
- Profile updates use optimistic concurrency control based on the version last read. A stale update is rejected as a conflict and never silently overwrites newer data.
- After a conflict, the UI loads the latest values, identifies that the profile changed, and requires the School Admin to review and resubmit. Opening the page does not lock the profile.
