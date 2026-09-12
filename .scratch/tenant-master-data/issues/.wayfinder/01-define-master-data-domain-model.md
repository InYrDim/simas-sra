# Define the Tenant Master Data domain model

Type: grilling
Status: resolved
Blocked by: none

## Question

What are the canonical entities, identifiers, Tenant-ownership rules, relationships, uniqueness constraints, active/archive lifecycle semantics, and cross-module invariants for the nine Master Data areas, especially where a person record, a school role, and an authenticated user may be different concepts?

## Answer

### Ownership and identity

- Every Master Data record belongs to exactly one Tenant and is never shared or moved across Tenants. A destination school creates its own record even when an official identifier matches a record in another Tenant.
- Every entity uses a stable internal identifier. Optional official identifiers such as NISN, NIP, and NUPTK are attributes rather than primary identity and must be unique within the Tenant when present.
- Names are not identifiers and must not be used alone for duplicate detection.

### People and authentication

- Warga Sekolah is the canonical person identity within a Tenant. Siswa, Guru, and Staf are separate profiles attached to it, and one person may hold multiple profiles, such as Guru and Staf.
- A person record can exist without an authenticated Akun Pengguna. One Warga Sekolah may optionally link to at most one Akun Pengguna in the same Tenant.
- School Admin authority comes from the account role, not from a person profile. A School Admin may optionally link to a Warga Sekolah; archiving employment data does not revoke the role, and revoking the role does not remove personnel history.
- Profiles can be archived independently. Warga Sekolah can be archived after all profiles are inactive. Archiving warns about, but does not automatically disable, a linked active account; account access remains the responsibility of Manajemen Pengguna.
- Siswa lifecycle statuses are Aktif, Lulus, Pindah, and Keluar, with effective dates. Guru and Staf assignment statuses are Aktif, Cuti, and Berakhir; Berakhir records an effective date and structured reason such as pension, transfer, resignation, or contract completion.

### School identity

- Tenant remains the source of truth for Provider-governed platform identity and lifecycle, including NPSN and domain.
- Each Tenant has exactly one Profil Sekolah for School Admin-managed attributes such as display name, logo, address, contacts, and other operational details. NPSN and domain may be displayed there but are not duplicated or editable.

### Academic structure

- Tahun Ajaran is Master Data with Draft, Aktif, and Ditutup lifecycle states. A Tenant may prepare drafts while exactly one Tahun Ajaran is active; activation is explicit rather than date-driven.
- Every Tahun Ajaran has canonical Ganjil and Genap semesters, with exactly one active semester inside the active Tahun Ajaran.
- Rombongan Belajar is period-specific. Student membership preserves history with start/end periods; a Siswa may have only one active Rombongan Belajar membership at a time, while transfers close the old membership and create a new one.
- Rombongan Belajar is distinct from a physical Lokasi. It may optionally reference a primary Lokasi, and locations may be shared over time.
- Mata Pelajaran is a stable Tenant-owned catalog with a Tenant-unique code. Periodic assignment to grade levels, Rombongan Belajar, Guru, and schedules belongs to downstream teaching or scheduling modules.

### Facilities and student activities

- Sarana & Prasarana distinguishes Lokasi, individually tracked Aset Individual with unique asset codes, and quantity-based Persediaan Agregat. Condition and movement changes preserve history.
- The former Organisasi area is renamed Organisasi & Ekstrakurikuler and separates Organisasi Siswa from Ekstrakurikuler.
- Their catalogs persist across years, while student membership, leadership positions, and Guru/Staf advisor assignments are effective-dated per Tahun Ajaran. Closing a year closes period membership without archiving the catalog.

### Archive, references, and audit

- Archive means inactive, never hard-deleted. Archived records cannot be selected for new relationships but remain readable through historical references.
- Archiving does not cascade. It is rejected while blocking active relationships remain, and the UI must identify those blockers. Reactivation is permitted when current uniqueness and lifecycle constraints remain valid.
- Unique identities remain reserved after archive; the old record is reactivated rather than duplicated. Period-specific codes may repeat only when their uniqueness scope includes Tahun Ajaran.
- All records retain creator/creation time and last editor/edit time. Detailed effective-dated history is required for lifecycle changes, Rombongan Belajar membership, organization/extracurricular membership and leadership, advisor assignments, asset movement and condition, and Tahun Ajaran lifecycle.
- Bulk imports additionally retain batch/file identity, actor, time, and per-row outcomes. Generic full-field versioning is not required for ordinary profile corrections in the first release.
