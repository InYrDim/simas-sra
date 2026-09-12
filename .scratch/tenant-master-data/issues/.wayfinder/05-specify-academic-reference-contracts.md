# Specify Tahun Ajaran, Mata Pelajaran, and Rombongan Belajar contracts

Type: grilling
Status: resolved
Blocked by: 01, 02

## Question

Which fields, identifiers, period and semester rules, education-level rules, membership and teaching relationships, uniqueness constraints, list/edit workflows, activation/closure, and archive/reactivation behaviors define Tahun Ajaran, Mata Pelajaran, and Rombongan Belajar without prematurely implementing Penjadwalan or other downstream modules?

## Answer

### Tahun Ajaran identity and periods

- Each Tahun Ajaran has a stable internal identifier, a Tenant-unique canonical label such as `2026/2027`, and explicit start and end dates.
- Every Tahun Ajaran owns exactly two mandatory Semesters, `Ganjil` and `Genap`. Each Semester has explicit start and end dates contained within its Tahun Ajaran; the two ranges are ordered, contiguous, and non-overlapping.
- Non-archived Tahun Ajaran date ranges cannot overlap within a Tenant. Labels and date ranges remain reserved after archive or cancellation.
- Dates support display and validation but never trigger lifecycle transitions automatically. A transition outside the current calendar range is allowed after a warning and confirmation.
- Each Semester has one of `Belum Aktif`, `Aktif`, or `Selesai`. Semesters cannot be created, archived, or deleted separately from their Tahun Ajaran.

### Tahun Ajaran lifecycle

- A Tahun Ajaran follows either `Draft → Aktif → Ditutup` or `Draft → Dibatalkan`. Exactly one Tahun Ajaran may be `Aktif` in a Tenant.
- Activation is explicit and atomic: the Tahun Ajaran and its `Ganjil` Semester become active, while selected valid Draft Rombongan Belajar and their planned memberships may become active in the same operation. Any conflict rejects the whole activation.
- Rombongan Belajar may remain Draft after their Tahun Ajaran becomes active and may be activated later after fresh validation.
- Moving to `Genap` is explicit, atomic, and forward-only: `Ganjil` becomes `Selesai` as `Genap` becomes `Aktif`. The active Semester cannot return to `Ganjil`.
- A Tahun Ajaran may be closed only while `Genap` is active and after every active relationship has been ended and every Rombongan Belajar is closed or cancelled. Closing it also completes `Genap`.
- A closed Tahun Ajaran cannot be reopened as active. Corrections may be made only when they preserve its lifecycle and historical validity.
- Cancelling a Draft Tahun Ajaran atomically cancels its Draft Rombongan Belajar and planned relationships after impact review and confirmation. A cancelled year cannot become Draft or active again.
- `Ditutup` and `Diarsipkan` are distinct. Only a closed or cancelled Tahun Ajaran may be archived. Reactivating its archive restores the prior closed/cancelled state, never an active state.

### Mata Pelajaran catalog

- Mata Pelajaran is a stable Tenant-owned catalog record with a stable internal identifier, required code, required name, one or more applicable education levels, optional description, and active/archive state.
- One Mata Pelajaran may apply to multiple education levels. It is not bound here to a grade, Tahun Ajaran, Rombongan Belajar, teaching load, passing threshold, curriculum instance, Guru, or schedule.
- Code and name are each unique within the Tenant after case and whitespace normalization. Archived records keep these values reserved and are reactivated rather than duplicated.
- A newly created Mata Pelajaran is immediately active; it has no Draft or closed state.
- Code, name, education levels, and description may be edited while active because the internal identifier preserves references. Every change is audited.
- An archived Mata Pelajaran is read-only. Reactivation must pass current uniqueness validation.

### Rombongan Belajar identity and structure

- A Rombongan Belajar belongs to exactly one Tahun Ajaran for the whole year rather than being recreated per Semester.
- It has a stable internal identifier, education level, controlled grade level, group name, optional code, optional capacity, and optional primary Lokasi.
- Valid controlled grades are SD/MI 1–6, SMP/MTs 7–9, and SMA/MA/SMK/MAK 10–12. The group name remains flexible for forms such as `A`, `IPA 1`, or `RPL 2`.
- Its normalized name is unique by Tahun Ajaran, education level, grade, and group name. An optional code is unique within the Tenant and Tahun Ajaran. These period-scoped values may repeat in another year.
- Capacity overruns warn but do not hard-block membership changes.
- Once active, Tahun Ajaran, education level, and grade are immutable. Name, code, capacity, primary Lokasi, and Wali Kelas may still be changed subject to validation.

### Rombongan Belajar lifecycle

- A Rombongan Belajar follows either `Draft → Aktif → Ditutup` or `Draft → Dibatalkan`.
- It can become active only while its Tahun Ajaran is active. Activation revalidates uniqueness, members, Wali Kelas, education level, and all relationships atomically.
- A closed Rombongan Belajar cannot return to active. A Draft that never operated is cancelled rather than closed; its planned relationships are cancelled but retained as planning history.
- Closed or cancelled Rombongan Belajar may be archived. Reactivation restores their prior closed/cancelled state and never reactivates old relationships.
- Any Draft Rombongan Belajar remaining when its Tahun Ajaran is closed must first be cancelled.

### Student membership

- A Siswa may have at most one active Rombongan Belajar membership at a time. All historical membership intervals must be non-overlapping and contained within the relevant Tahun Ajaran.
- Membership intervals use an exclusive end boundary: `start ≤ membership < end`. A transfer can therefore close the old membership and start the new one on the same effective date without overlap.
- A transfer within a Tahun Ajaran is one atomic action that closes the old membership, records a structured reason, and starts the new membership. Failure of any step rejects the whole transfer.
- An active Siswa may be placed into at most one planned Rombongan Belajar per Draft Tahun Ajaran while retaining an active membership in the current year. Planned membership is not active membership.
- Planned membership is revalidated when activated. Activation requires the previous year to be closed, an eligible active Siswa, a valid Rombongan Belajar, matching education level, and no membership conflict.
- Grade promotion is never automatic. The system may suggest the next grade, but School Admin explicitly confirms each placement.
- Siswa with effective `Lulus`, `Pindah`, or `Keluar` status cannot hold active or future planned membership after that status takes effect.
- An active membership is never deleted. Removing a Siswa records an effective date, a structured reason such as transfer, graduation, departure, or correction, and an optional note. Only a never-active planned placement may be cancelled.
- Historical corrections are audited rather than implemented as deletion.

### Wali Kelas and teaching boundary

- A Rombongan Belajar may have zero or one active Wali Kelas at a time. The assignment references an active Guru in the same Tenant, has start/end dates inside the Tahun Ajaran, and preserves replacement history.
- A Guru may be active Wali Kelas for only one Rombongan Belajar at the same time within a Tahun Ajaran.
- A Wali Kelas assignment may be planned while its Rombongan Belajar is Draft and is revalidated on activation. It does not end merely because the Semester changes.
- Wali Kelas does not imply that the Guru teaches any Mata Pelajaran.
- Guru–Mata Pelajaran–Rombongan Belajar assignments, curriculum delivery, teaching loads, and schedules belong to downstream teaching or Penjadwalan modules and are not implemented by these Master Data contracts.

### List and edit workflows

- Tahun Ajaran lists newest first and show label, dates, active Semester, lifecycle state, and available actions.
- Mata Pelajaran lists support code/name search plus education-level and archive filters.
- Rombongan Belajar lists support Tahun Ajaran, education-level, grade, lifecycle, and archive filters plus name/code search; rows show member count, capacity, Wali Kelas, and primary Lokasi.
- Archived records are excluded by default but remain available through filters. Returning from detail or edit preserves list filters and pagination.
- Archived records are read-only until reactivated.
- Active Tahun Ajaran labels or dates may be corrected only when no Semester or related history would fall outside the corrected boundaries; Semester order is immutable.
- Mutations that would invalidate historical relationships are rejected with actionable blockers.

### Archive and blocker behavior

- Archive never cascades and never silently closes a relationship.
- Mata Pelajaran cannot be archived while referenced by an active or planned teaching relationship.
- Rombongan Belajar cannot be archived with active or planned memberships or Wali Kelas assignments.
- Tahun Ajaran cannot be archived until it is closed or cancelled and all contained Rombongan Belajar are closed or cancelled.
- The UI identifies each blocker type and count. Reactivation rechecks current uniqueness and validity but never reactivates prior relationships automatically.
