# Prototype the Tenant role-management UI

Type: prototype
Status: resolved
Blocked by: 03, 04, 05

## Question

What Tenant UI best supports role discovery, role creation and copying, grouped permission editing, multi-role assignment, effective-access explanation, destructive-impact warnings, loading states, accessibility, and audit-history inspection?

## Answer

### Recommendation

Use one School-Admin-only **Akses & Peran** area in the existing authenticated Tenant shell, with two first-level destinations:

1. **Peran** — discover, create, copy, edit, activate, archive, restore, and inspect Tenant roles.
2. **Akun Pengguna** — discover eligible accounts, assign multiple roles, and inspect effective access.

Do not combine both concerns in one dense matrix. Roles answer “what authority exists”; accounts answer “who has it.” Keep the existing `/users` concept as the account destination and add the role destination beside it under a **Pengguna & Keamanan** navigation group. Audit is contextual in both destinations, with a shared full history view linked from each detail. The area is visible only to School Admin because RBAC administration and authorization-audit access are `school-admin-only`; hiding navigation is feedback, while server authorization remains authoritative.

This is a specification recommendation, not an implementation prototype. The map explicitly keeps implementation out of scope until the RBAC specification is decision-complete.

### Information architecture and discovery

#### Peran list

The default **Peran** page is a paginated, server-searched table rather than cards. Its header contains the title, a short explanation, and primary action **Buat peran**. Controls include:

- search by normalized role name;
- status filter: Semua, Draf, Aktif, Diarsipkan;
- origin filter: Dari awal, Dari template, Salinan;
- sort by name, last changed, or number of active users;
- an explicit **Hapus filter** action and result count.

Columns are **Nama peran**, **Status**, **Izin**, **Pengguna aktif**, **Asal**, **Terakhir diubah**, and an accessible actions menu. Each row is one linkable role. Status uses text plus a badge, never color alone. The School Admin system role appears in a separate read-only context panel, not among editable roles: it explains that Provider owns its lifecycle and that it cannot be copied, assigned, or edited. Code-defined templates are exposed only inside creation, not as active role rows, because templates grant no access.

Default empty state: **Belum ada peran Tenant** with **Buat dari template** and **Buat dari awal** actions. Filtered empty state: **Tidak ada hasil** with **Hapus filter**. An archived-only result remains discoverable and clearly read-only. The role detail URL must use immutable role ID; the mutable name is presentation only.

#### Account list

Evolve the existing **Manajemen Pengguna** table into a paginated, server-searched account directory. Search name/email without exposing cross-Tenant existence. Filters are current role, **Tanpa peran**, account status, and linked profile kind. Rows show name, email, account status, linked Warga Sekolah/profile context where available, assigned-role badges, and a derived access summary. School Admin may appear as non-editable Provider-managed context but must never expose assignment controls.

Inactive and suspended accounts remain visible and labeled, but assignment controls are disabled with an explanation. A Warga Sekolah record without an Akun Pengguna is not listed as an assignment target. Account creation/invitation is not folded into role assignment; issue 14 owns that lifecycle.

### Role creation and copying

**Buat peran** opens a focused route or full-height responsive sheet with a three-choice start step:

- **Gunakan template** — Pimpinan, Guru, Staf, Siswa, or Tamu, with template version, permission count, and short purpose;
- **Salin peran aktif** — searchable active custom roles only;
- **Mulai dari awal**.

School Admin is never offered as a source. Deprecated templates are absent from new creation and may be mentioned only as historical provenance.

The next step collects a required unique name and optional description, then previews copied permissions and provenance. Name validation explains normalized, case-insensitive conflicts and reserved School Admin variants. Submit always creates a **Draf** with a new immutable ID, no assignments, and no copied audit history. Success lands on the new role editor with a status announcement. Cancel warns only when the user has changed input.

Creation has distinct pending labels and spinners—**Membuat draf…**, **Menyalin peran…**—and disables duplicate submission without disabling navigation or screen-reader status announcements.

### Role detail and grouped permission editor

Use a stable role-detail header with role name, status badge, origin/provenance, active-user count, last-change metadata, and allowed lifecycle actions. Under it, use URL-addressable tabs so refresh/back/share preserve context:

- **Izin**;
- **Pengguna**;
- **Riwayat**.

Archived roles open read-only. Restoring creates an unassigned draft and says explicitly that former assignments are not restored. Draft roles may have zero permissions. Active roles must retain at least one valid assignable permission.

The **Izin** tab uses the registry's Indonesian UI groups as accordion sections: Pengguna & Keamanan, Profil Sekolah, Akademik, Warga Sekolah, Impor Data, Sarana & Prasarana, Kegiatan Siswa, PPDB, Ulangan, and Pengaturan Tenant. A sticky summary shows selected permission count and unsaved additions/removals. Search matches label, description, resource, or action; optional risk filters expose sensitive/critical items. Internal keys may appear as secondary copyable technical detail, never as editable input.

Each permission row contains:

- native semantic checkbox behavior through the design-system checkbox;
- Indonesian label and description;
- explicit action/risk badge where useful;
- dependency explanation;
- **Tidak tersedia untuk Tenant** when the permission is composed into the role but its entitlement is unavailable.

Only `tenant-assignable` permissions are selectable. `school-admin-only` and `system-internal` entries are absent rather than disabled temptations. Selecting a permission automatically selects all declared dependencies. Required dependencies are checked and locked while depended upon, with text such as **Diperlukan oleh: Impor data** and a link/focus action to the dependent permission. Removing a dependency first presents the exact dependent permissions that will also be removed; confirmation applies the complete valid closure. Group-level **Pilih semua yang tersedia** and **Kosongkan grup** operate on concrete keys, report how many dependencies are added/retained, and never persist wildcards.

A visible legend explains **Dipilih**, **Wajib karena dependensi**, **Sensitif/Kritis**, **Tidak tersedia untuk Tenant**, and **Usang—perlu migrasi**. Deprecated/unknown/removed keys on an existing role render in a blocking repair panel; they cannot be newly selected, and activation/save-to-active is unavailable until corrected according to registry replacement metadata.

Saving a draft is direct after client validation. Saving an active role always opens an impact review before mutation.

### Active-role impact and destructive actions

The impact review is a modal dialog for concise changes and a dedicated review route/sheet when the diff is long. It must show:

- affected active-user count, with a link to the user list;
- exact permission additions and removals, grouped and deduplicated;
- dependency-driven changes separately labeled;
- sensitive/critical additions prominently marked;
- statement that effective access changes on each holder's next request;
- required reason for sensitive/critical additions and any lifecycle/destructive change;
- role version being changed.

Do not use a generic “Are you sure?” prompt. The primary button names the consequence, for example **Simpan dan ubah akses 24 pengguna**. While pending it becomes **Menyimpan perubahan…** with a loader. The dialog cannot be dismissed by accidental outside click while submitting.

Moving an active role to draft or archive is blocked while active assignments exist. The blocking view lists the count and offers **Tinjau pengguna terdampak** and a migration workflow; it never silently revokes users. Archive is the destructive Tenant action—there is no hard delete. Restoring an archive explicitly produces a draft with no restored assignments. Rename previews no permission change but still records identity before/after in history.

If optimistic version validation fails, preserve local edits, show **Peran ini telah berubah**, summarize the newer server version, and offer **Bandingkan perubahan**, **Muat ulang versi terbaru**, or **Salin perubahan saya**. Never retry a stale write automatically.

### Multi-role assignment

From an account detail, **Ubah peran** opens an editor listing active custom roles as checkboxes with search and concise permission/risk summaries. The current complete assignment set is preselected. The save operation replaces that set atomically; role chips are not independently mutated.

A persistent **Perubahan akses** panel computes before/after:

- roles added, retained, and removed;
- deduplicated effective permissions gained and lost;
- sensitive/critical effective permissions;
- redundant overlap, expressed as information rather than an error;
- permissions unavailable because of Tenant entitlement;
- whether the account will have zero roles.

The confirmation names the account and says changes apply on the next request. A mandatory reason appears for revocation, sensitive/critical grants, suspended-assignment restoration, or a zero-role result. Removing the final role uses explicit copy: **[Name] akan kehilangan seluruh akses bisnis** and lists all lost effective permissions. Additive combinations are never blocked merely because they appear inconsistent with a linked profile; show a non-blocking warning that profiles describe the person while roles grant application authority.

Inactive/suspended accounts cannot receive assignments. On reactivation, the UI must require an explicit choice between valid former roles and no role; it never silently restores suspended grants.

For bounded bulk assignment, enter through row selection on the account list, then choose exactly one active role and **Tambah ke akun terpilih** or **Cabut dari akun terpilih**. Cap selection at 100 and show a preview grouped into changed, unchanged, invalid, and resulting-zero-role accounts. Sensitive access and zero-role outcomes are prominent. One stale/invalid target blocks the atomic batch; keep the selection and explain which prerequisite changed. Bulk changes always require a reason and expose one `batchId` in resulting history.

### Effective access explanation

The account-detail default is **Akses efektif**, not merely a list of roles. Start with assigned active role chips, then show the deduplicated permission union grouped by the same registry UI groups. Every permission lists all source roles. A source popover or expandable row answers “Mengapa pengguna ini memiliki akses ini?” Sensitive/critical permissions have text badges.

Show three distinct concepts without conflating them:

1. **Diberikan oleh peran** — additive RBAC sources;
2. **Tidak tersedia untuk Tenant** — role contains the permission but entitlement prevents availability;
3. **Batas cakupan data** — class, unit, teaching, or other contextual relationships may still constrain records.

The third section explicitly says these limits are not roles and are not deny rules. An account with zero roles receives a prominent **Akses belum diberikan** state and no business-permission rows. Archived roles and suspended assignments may appear in a history/context section but never in the effective union.

### Audit history

The **Riwayat** tab exists on both role and account detail. Entries form a newest-first semantic list/table containing timestamp, actor, action, reason where required, affected entity, version before/after, and a concise diff. Expand an entry to show permission or assignment additions/removals, affected-user count, role-name snapshot, provenance/template version, and `batchId` linkage. Renames continue to show immutable ID and the historical name snapshot.

Filters include action, actor, date range, risk, and batch ID. A role links to assignment events involving it; an account links to role-definition events that explain a current permission. Audit data is read-only and `school-admin-only`. Empty copy distinguishes **Belum ada riwayat** from **Tidak ada riwayat yang cocok dengan filter**. History fetch failure does not hide the current role/access data; render a retryable regional error.

### Loading, success, error, empty, and stale states

Every noticeable asynchronous operation has explicit feedback, satisfying the repository loading-state rule:

- route transition/list/detail: preserve the Tenant shell and render table/header/detail skeletons with stable dimensions;
- search/filter/pagination: retain current rows with `aria-busy="true"`, show a nearby spinner/status **Memperbarui hasil…**, and prevent old responses replacing newer queries;
- permission/effective-access expansion: regional loader, not a full-page blank state;
- create/copy/save/activate/archive/restore/assign/bulk actions: loader in the initiating button, consequence-specific pending label, duplicate-submit prevention, and a polite live status;
- long impact calculation: skeleton the impact panel and keep confirmation disabled until authoritative preview succeeds;
- audit pagination/filtering: retain current history while loading and expose regional retry.

Success is announced through `role="status"` and visible confirmation. Validation errors appear in an error summary linked to fields and inline beside the relevant control. Authorization loss returns a consistent access-denied view, not an empty state. Not found distinguishes a missing role/account from denied access without leaking cross-Tenant existence. Network/server errors preserve safe local input and offer retry. Unknown error copy includes a support correlation ID when available, never raw internals.

Empty states distinguish: no roles yet, no accounts yet, no search result, zero assigned roles, no effective permissions, and no audit events. Each offers only an action valid for that state.

Stale list/detail reads show **Data mungkin sudah berubah** with refresh. Stale mutations fail closed, preserve user work, and require comparison/reload. If a selected role becomes draft/archived during assignment preview, block the entire save and refresh the authoritative role set.

For a future App Router implementation, place route-level loading/error boundaries at the smallest useful Akses & Peran segment and use component-level pending states for mutations and regional fetches. Before implementation, consult the installed version's App Router documentation as required by `monorepo/AGENTS.md`; this issue does not prescribe version-sensitive APIs.

### Responsive behavior

Desktop uses a list/detail workspace: table or searchable list on the left and a linkable detail panel on the right where the existing master-data pattern supports it. At narrower widths, collapse to a single-column list → detail route; never squeeze the permission matrix or impact diff into horizontal scrolling as the primary interaction.

On mobile:

- filters open in a sheet with active-filter count;
- table rows become labeled list items/cards while preserving the same information and actions;
- grouped permissions remain accordions with a sticky bottom summary/save bar that does not cover content;
- impact review becomes a full-height sheet/route;
- dialogs that contain multi-step or long content become routes/sheets;
- touch targets are at least the repository's established `min-h-11` pattern.

Bulk selection remains available but shows selected count and the 100-account limit persistently. Focus returns to the initiating control after a sheet/dialog closes.

### Accessibility contract

- One page `h1`; logical `h2`/`h3` hierarchy for groups and impact sections.
- Prefer native table, fieldset/legend, checkbox, button, and link semantics through `components/ui`; never make a clickable row the only way to act.
- Every checkbox has a visible label and description association. Group select-all exposes checked/mixed/unchecked state programmatically.
- Accordion, dialog, sheet, tabs, tooltip, alert, badge, skeleton, spinner, empty, and table come from the existing design system where applicable.
- Full keyboard operation, visible focus, predictable tab order, dialog focus trap, Escape behavior when not submitting, and focus restoration are mandatory.
- Status/risk never relies on color or icon alone. Icons used decoratively are hidden from assistive technology.
- Loaders use `role="status"`/polite live regions and respect reduced motion; destructive and validation failures use `role="alert"` where immediate interruption is warranted.
- Search/filter updates do not steal focus. Result counts are announced politely.
- Permission dependencies are conveyed in text, not only by disabled state or connector graphics.
- Long permission/audit lists remain usable at 200% zoom and with reflow; do not require two-dimensional scrolling.
- Destructive confirmation initially focuses its heading or consequence summary, not the destructive button.

### Security and data-boundary requirements

The UI must never be treated as authorization enforcement. Every list, preview, detail, mutation, and audit request derives Tenant and actor authority server-side, accepts immutable IDs rather than email/name as identity, and revalidates role status, assignability, dependencies, account eligibility, versions, and impact at commit time. UI previews are advisory; the server returns the authoritative diff used for confirmation and audit. Search and error copy must not reveal accounts or roles from another Tenant. Reasons are length-validated and warn users not to enter credentials or secrets.

### Alternatives considered

1. **One users × roles permission matrix** — rejected. It makes multi-role effects and permission dependencies difficult to explain, performs poorly responsively, encourages per-cell non-atomic mutations, and conflates role composition with assignment.
2. **Card-only role gallery with modal editing** — rejected. Cards scan poorly as role count grows, long permission/dependency and impact flows exceed modal constraints, and URLs/back navigation cannot reliably preserve state.
3. **Recommended list/detail workspace with separate role and account destinations** — chosen. It matches the repository's table and master-data list/detail conventions, gives each security concept a stable URL, supports progressive disclosure, and adapts cleanly to mobile routes/sheets.

### Evidence and implementation handoff

- `03-define-permission-language-and-catalog.md` fixes concrete code-owned permission keys, Indonesian metadata/groups, dependencies, risk and assignment classes, unavailable/deprecated states, and the non-delegable RBAC-administration boundary. These directly determine the permission editor and legends.
- `04-define-system-and-custom-role-lifecycle.md` fixes system/template/custom distinctions, normalized unique names, draft/active/archive transitions, copy semantics, next-request impact, optimistic versions, audit payload, and no hard delete. These determine creation, detail actions, destructive previews, and stale handling.
- `05-define-user-assignment-workflows.md` fixes eligible accounts, zero-role behavior, atomic multi-role replacement, effective-access provenance, entitlement/context explanation, bounded atomic bulk changes, suspended assignments, and reason requirements. These determine the account directory and assignment flows.
- `map.md` fixes universal Tenant RBAC, additive grants with no deny, separation from person profiles and Provider authorization, server-authoritative fail-closed checks, and implementation being out of scope.
- `monorepo/app/(tenant)/[domain]/(authenticated)/users/page.tsx` establishes the existing Indonesian **Manajemen Pengguna** table, role/status badges, empty row, and `p-4 md:p-6` density, but its singular `tenantRole` presentation must be replaced by the specified multi-role model during implementation.
- `monorepo/app/(tenant)/[domain]/(authenticated)/layout.tsx` establishes the authenticated Tenant sidebar/header shell and responsive content spacing; Akses & Peran belongs inside it rather than in a disconnected prototype shell.
- `monorepo/app/(tenant)/[domain]/(authenticated)/master/guru/page.tsx` and the master-data workspace establish server-driven list/detail navigation, Indonesian labels, read-only/archive notices, impact context, required reasons, optimistic version fields, `min-h-11` controls, and responsive grids.
- `monorepo/components/master-data/workspace-states.tsx` establishes accessible loaders (`role="status"`, `aria-live`, reduced motion), regional retry errors, distinct default/filtered empty states, and conflict copy that preserves input.
- `monorepo/components/ui` already provides the needed primitives, including accordion, alert dialog, badge, button, checkbox, combobox, dialog, empty, field, input, pagination, scroll area, select, sheet, skeleton, spinner, table, tabs, textarea, and tooltip.
- The current Provider audit page is only an empty placeholder, so it is not a sufficient interaction precedent; the audit specification above follows the RBAC audit payloads fixed by issues 04 and 05 instead.

Implementation acceptance should validate this recommendation with task-based usability sessions covering: create from template, resolve a dependency removal, safely edit an active role affecting many users, assign two overlapping roles, remove the last role, diagnose one effective permission, recover from a stale edit, and inspect a bulk audit event on desktop, keyboard-only, screen reader, and narrow viewport.
