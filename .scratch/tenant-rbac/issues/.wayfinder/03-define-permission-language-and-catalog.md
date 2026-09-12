# Define the permission language and catalog

Type: grilling
Status: resolved
Blocked by: 02

## Question

What canonical naming scheme, action vocabulary, grouping, metadata, stability rules, and initial module catalog should system-owned permissions use so server checks and the permission-editor UI share one contract?

## Answer

### Identity and naming

Every Permission Tenant has a stable, code-defined key in the form `<module>.<resource>.<action>`. Keys use English `lowercase-kebab-case`; Indonesian labels and descriptions are separate UI metadata. Keys describe business capabilities rather than routes, pages, menus, or components, so navigation changes do not rename permissions.

No assignable wildcard keys exist. UI may offer bulk selection, but roles persist concrete permission keys. Module roots for the initial catalog are:

- `tenant`
- `school-profile`
- `academic-years`
- `subjects`
- `class-groups`
- `people`
- `students`
- `teachers`
- `staff`
- `people-imports`
- `facilities`
- `assets`
- `student-organizations`
- `extracurriculars`
- `ppdb`
- `quizzes`
- `tenant-settings`

### Action vocabulary and granularity

Use common actions such as `view`, `create`, `update`, `archive`, `restore`, `manage-lifecycle`, `assign`, `unassign`, `import`, `export`, `download`, `approve`, `reject`, `publish`, and `close` where their domain meaning fits. Use a specific business action such as `assign-roles`, `execute`, `decide`, or `adjust` when a generic CRUD verb would hide a security-sensitive distinction.

`update` never implicitly permits archive, approval, assignment, publication, import execution, or another sensitive lifecycle operation. `manage` is reserved for a capability that cannot usefully be separated.

Normal `view` returns only the operational minimum. Sensitive fields, sensitive documents, bulk exports, user contact details, and security audit data require explicit permissions such as `view-sensitive`, `view-contact`, `view-audit`, or `export`. The server must omit or mask protected fields; hiding UI columns is not enforcement.

### Dependencies and evaluation

Permissions have no hidden inheritance. If `update` requires `view`, a role stores both keys. Registry metadata declares dependencies; the role editor automatically selects and locks required dependencies, and server-side role validation rejects invalid combinations. Runtime operations still check the specific permission they require.

### Registry and metadata

The version-controlled code registry is the source of truth shared by server enforcement and the role editor. Tenant administrators cannot create permission types. Database records store Tenant roles, role-to-key assignments, user-to-role assignments, and audit history only.

Each registry entry carries at least its key, module, resource, action, Indonesian label and description, UI group/order, dependency keys, risk classification, assignment classification, lifecycle status, and replacement keys when deprecated.

Assignment classifications are:

- `tenant-assignable`: School Admin may include it in a custom role.
- `school-admin-only`: effective for School Admin but never delegable.
- `system-internal`: used by system policy and absent from the role editor.

RBAC administration—including role management, role assignment, and authorization audit access—is `school-admin-only`. It cannot be delegated because doing so would permit privilege escalation. Other sensitive but delegable permissions use `sensitive` or `critical` risk metadata so UI can warn and require explicit confirmation.

### Stability and catalog admission

A released key is never reused with a different meaning. Labels and descriptions may change without changing the key. Semantic changes create a new key; the old key becomes deprecated with explicit replacement keys. Deprecated assignments remain readable during migration but cannot be selected for new assignments. Migration is explicit and audited. A key is removed only after persisted references are verified absent.

Unknown, removed, malformed, or otherwise invalid permission keys fail closed and grant nothing.

The catalog admits only capabilities backed by real server enforcement. Placeholder menus do not create permissions. A new module capability ships its registry entry, enforcement point, and tests together. The exhaustive operation-to-permission mapping is owned by [Map current operations to permissions](./13-map-current-operations-to-permissions.md).

### Permission-editor grouping

UI groups are metadata, not key prefixes. Initial groups are Pengguna & Keamanan, Profil Sekolah, Akademik, Warga Sekolah, Impor Data, Sarana & Prasarana, Kegiatan Siswa, PPDB, Ulangan, and Pengaturan Tenant. A permission keeps the same identity if navigation or group labels change.
