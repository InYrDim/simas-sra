# Define the consistent Master Data UX

Type: prototype
Status: resolved
Blocked by: 03, 04, 05, 06, 07

## Question

What shared page, table, form, empty-state, search/filter, pagination, archive/reactivation, responsive, accessibility, loading, error, and confirmation patterns should make all nine Master Data pages consistent while preserving entity-specific workflows?

## Answer

### Chosen information architecture

- Combine prototype Variants B and C. Preserve the prototype source at [`prototypes/master-data-ux-b-c-source.tsx`](../prototypes/master-data-ux-b-c-source.tsx) as a decision artifact, not production code.
- Variant C becomes a new School Admin landing page at `/master`: a task-oriented overview answering “what needs attention?” across Master Data.
- Variant B becomes the shared operational workspace for the nine entity pages, answering “how do I inspect and manage this record?”
- Do not stack dashboard cards above every entity list. Cross-entity metrics and exceptions belong on `/master`; entity pages reserve their space for searching, comparing, inspecting, and acting on records.
- The Master Data menu header links to `/master`; its child entries link directly to the nine entity pages. All navigation remains School Admin-only under the established authorization contract.

### Master Data overview

- `/master` shows concise aggregate counts, actionable exceptions, recent Master Data activity, and quick links. It is not a second editing surface or a replacement for entity lists.
- Overview cards link to a deterministic entity-page filter, such as active Siswa without a current Rombongan Belajar or facilities requiring review.
- Only surface an exception when the relevant contract can define it accurately. The overview must not invent generic “health scores,” silently infer lifecycle changes, or imply that every missing optional field is a problem.
- Quick actions include entity-specific creation and the approved Siswa/Guru/Staf import entry points. Actions open the same production form or workflow used from the entity page.
- Recent activity shows meaningful audited Master Data changes within the current Tenant, without exposing sensitive before/after values in the overview.
- Each card has a text label, value, explanation, and destination; color is supplementary and never the only status signal.

### Shared entity workspace

- Siswa, Guru, Staf, Mata Pelajaran, Rombongan Belajar, Sarana & Prasarana, Organisasi & Ekstrakurikuler, and Tahun Ajaran use a list/detail split workspace on sufficiently wide screens.
- Profil Sekolah uses the same page header, section, validation, form, loading, error, conflict, and audit-history patterns, but not an artificial list because there is exactly one profile per Tenant.
- The entity workspace consists of a page header, primary action, search/filter toolbar, result list, and a detail panel. Selecting a record updates the URL so selection is shareable and browser navigation works.
- Initial navigation without a selected record shows the list plus an entity-specific guidance panel. Deep-linking to an unknown, unauthorized, or cross-Tenant record follows the established denial contract.
- The detail panel supports `Ringkasan`, entity-specific related data, and `Riwayat` tabs where applicable. It presents actions in context without making the entire panel immediately editable.
- Creation and complex edits use dedicated routes or large modal/sheet forms according to complexity. They do not replace list rows with inline form controls.

### Page headers and actions

- Every entity page header contains breadcrumb, singular/plural entity title, one-sentence purpose, and one emphasized primary action.
- The primary action is `Tambah …`, except Profil Sekolah uses `Edit Profil` and contexts that cannot currently mutate show no misleading primary action.
- Secondary actions such as import, template download, export if added later, and archive view use a stable overflow or secondary-action area. Siswa, Guru, and Staf expose the approved import workflow consistently.
- Buttons use verbs and entity names. Icon-only actions require accessible names and are reserved for universally recognizable compact controls.
- Controls are hidden or disabled for navigation clarity according to lifecycle state, but server authorization remains authoritative. Disabled mutation controls explain why the Tenant or record is read-only.

### Lists, tables, and density

- Desktop uses a compact selectable list compatible with the split panel. Columns are entity-specific and follow the display contracts already decided; no generic table forces every entity into identical columns.
- The first column is always the primary human-readable identity; lifecycle and archive states use text badges. Stable identifiers retain leading zeros and use tabular or monospace numerals where useful.
- Row selection opens detail; it does not navigate unpredictably or toggle a checkbox. Selection checkboxes are omitted because bulk edit and bulk archive are out of scope.
- Each row exposes a labelled overflow menu for permitted record actions. Destructive-looking lifecycle actions never execute directly from the menu without their required confirmation flow.
- User-configurable column persistence is not required in the first release. Responsive omission of secondary columns is allowed, but all contracted data remains available in detail.
- Profil Sekolah uses clearly named sections rather than a one-row table. Sarana & Prasarana provides distinct Location and Asset views under the shared workspace. Organisasi & Ekstrakurikuler provides distinct entity views without merging their domain identities.

### Search, filters, sorting, and URL state

- Search is server-backed, case-insensitive, debounced, and covers only the entity fields established by its contract. Identifier search ignores meaningless formatting as already decided.
- Search submits immediately with a visible clear control and accessible result announcement. Pressing Escape clears only when focus is in the search input.
- Filters use entity-specific values plus the shared record scope `Aktif`, `Diarsipkan`, or `Semua`. Applied filters appear as removable chips and `Hapus semua filter` is available.
- Sort choices are explicit and entity-specific; default sorting is stable, deterministic, and includes a unique tie-breaker.
- Search, filters, sorting, pagination cursor/page, archive scope, and selected record are represented in the URL. Reload, sharing, browser back, and links from `/master` preserve the same view.
- Unknown or obsolete query values fall back safely and surface no cross-Tenant information.

### Pagination

- Entity lists use server-side pagination with a default of 25 records and supported sizes of 25, 50, and 100.
- Pagination displays the visible range and total only when a reliable count is available. Otherwise it uses clear previous/next affordances without fabricating a total.
- Changing search, filter, sorting, archive scope, or page size returns to the first page. Closing a detail panel retains the current list position.
- After creation, the new record opens in detail even if it would not appear under the current filters; the UI explains the mismatch and offers to clear filters.
- After archive/reactivation changes remove a record from the current scope, show confirmation and select the next available row rather than leaving a broken detail panel.

### Detail, form, and validation patterns

- Detail is read-only by default. `Edit` opens a form initialized from a fresh server representation and protected by the conflict-safe update policy already specified.
- Forms group fields by domain meaning, not database table. Shared Warga Sekolah fields are clearly separated from Siswa/Guru/Staf profile fields and disclose when a change affects another profile.
- Required fields are labelled in text; optional status is also clear. Help text explains format or consequences before an error occurs.
- Validate on the server for authority and correctness. Client validation may provide early feedback but never replaces it.
- On submission, focus moves to the first invalid field, an error summary links to all invalid fields, user input remains intact, and each message states how to correct the value.
- Structured lifecycle changes—student status, employment status, appointments, academic period transitions, archive, and reactivation—use dedicated action flows, not ordinary edit fields.
- Unsaved changes trigger a leave confirmation. Successful saves return to refreshed detail with a concise confirmation; they do not silently close context.
- Concurrent-update conflicts preserve the School Admin’s input and offer `Muat data terbaru` plus a field-level comparison where practical. No last-write-wins overwrite is presented as success.

### Empty and zero-result states

- A true first-use empty state explains the entity, offers its primary creation action, and offers import only for Siswa/Guru/Staf.
- A zero-result state caused by search or filters says no records match, displays the active criteria, and offers to clear them. It never presents a creation CTA as if the entity were globally empty.
- An empty archive explains that no records have been archived. An empty related-data section explains whether adding a relationship is possible and where it is managed.
- Empty states remain informative in read-only Tenant states but suppress mutation CTAs that cannot succeed.

### Archive and reactivation

- Archive scope is a first-class filter, not a separate hidden page. Archived rows and detail panels are visibly marked and read-only.
- `Arsipkan` is presented separately from ordinary edits. Its confirmation names the record, explains non-deletion, lists blockers, reports account warnings where applicable, and requests lifecycle-specific reasons/dates already required by the entity contract.
- If blockers exist, confirmation becomes an explanatory blocked state with links to relevant relationships; there is no enabled submit button.
- Reactivation uses a dedicated confirmation that explains uniqueness and relationship revalidation and that prior lifecycle status or relationships are not automatically restored.
- Successful archive/reactivation shows the resulting scope and preserves an audit-visible outcome. There is no hard-delete language or trash icon implying deletion.

### Confirmations and irreversible-looking actions

- Do not confirm harmless navigation, opening forms, filtering, or ordinary saves. Confirm actions that change lifecycle, affect shared identity, discard unsaved work, or execute imports.
- Confirmation copy follows: action, exact target, consequences, blockers/warnings, and final verb. Generic `Apakah Anda yakin?` is insufficient.
- Confirmation buttons use the action name, such as `Arsipkan Siswa`, `Aktifkan Kembali`, or `Jalankan Impor`; `Batal` is always available and initially focused for high-impact actions.
- Typed-name confirmation is not required for archive/reactivation because these are reversible and audited. It remains inappropriate ceremony unless a future irreversible operation warrants it.

### Loading, mutation progress, and errors

- Initial list loading uses a stable skeleton matching the workspace structure. Filter/search transitions retain existing results with a progress indicator rather than blanking the page.
- Detail loading is isolated to the detail panel. Selecting another record does not block search or list navigation.
- Mutation controls disable only the action being submitted, show a labelled progress state, and prevent duplicate submission. Optimistic success is not used for lifecycle or relationship changes.
- Recoverable list/detail errors appear inside the failed region with `Coba lagi`; global error pages are reserved for failures that make the whole route unusable.
- Form and domain errors remain near their fields or action. Authorization/lifecycle denials use the established 403/404/read-only behavior and never masquerade as validation errors.
- Toasts supplement, but never replace, persistent success/error state. Errors include a support reference when the server supplies one, without exposing stack traces or sensitive data.

### Responsive behavior

- On desktop, the list and persistent detail panel appear side by side. The list remains wide enough to identify records and the detail panel remains wide enough for readable forms/history.
- On tablet, detail may use a large overlay sheet while preserving list state underneath.
- On mobile, the list becomes a card/list presentation of essential fields and detail becomes a full-screen route/view with a labelled Back action. Horizontal table scrolling is a last resort, not the primary mobile design.
- Filters use a full-height sheet on small screens with applied-count feedback. Primary creation remains reachable without obscuring content or the final rows.
- Form sections become one column; action bars remain visible without covering focused fields or the on-screen keyboard.

### Accessibility and localization

- All workflows are keyboard-operable with logical focus order, visible focus indicators, semantic headings, landmarks, form labels, table/list semantics, and labelled icon buttons.
- Opening a modal/sheet moves focus inside; closing returns focus to the invoking control. Route/detail changes move focus to the new heading or announce the update as appropriate.
- Loading, changed result counts, form errors, and mutation outcomes use restrained live-region announcements. Screen readers are not flooded by every keystroke during debounced search.
- Status is always conveyed by text and optionally icon/color. Contrast meets WCAG AA, touch targets are at least 44×44 CSS pixels where feasible, and motion respects reduced-motion preferences.
- User-facing copy is Indonesian. Dates, numbers, and times use Indonesian locale, while stored stable codes remain implementation/domain values rather than display labels.

### Entity-specific preservation

- Shared UX primitives standardize structure and behavior, not domain rules. Each entity retains its own fields, statuses, relationships, blockers, transitions, tabs, validation, and primary labels.
- Tahun Ajaran emphasizes forward-only period transitions; Rombongan Belajar exposes membership and Wali Kelas histories; people pages expose shared identity/account status; facilities distinguish Locations from Assets; organizations distinguish organizations, leadership, membership, extracurricular identities, and yearly groups.
- The import review workspace remains the separately approved spreadsheet-first Variant B workflow. It uses the same page header, errors, confirmations, accessibility, and result vocabulary but is not forced into the ordinary entity split layout.

### Prototype disposition

- The prototype validated information architecture only. Production implementation must recreate the chosen C-overview/B-workspace behavior using real authorization, routes, server pagination, forms, responsive semantics, accessibility, tests, and entity contracts.
- Throwaway variant components and the development switcher must not be promoted directly into production.
