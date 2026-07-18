# 01 — Separate Tenant navigation and adopt School Admin terminology

**What to build:** Tenant users continue to see their existing navigation through a dedicated Tenant-only sidebar, now with a scoped deep-navy theme and School Admin terminology. Provider concepts must not enter Tenant role or navigation types.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Tenant navigation uses explicit Tenant-only sidebar, menu renderer, configuration, and types while preserving all existing labels, destinations, grouping, submenus, and ordering except the required role rename.
- [ ] The Tenant sidebar uses a scoped deep-navy theme with accessible foreground, hover, active, border, and focus states that do not affect Provider or global styling.
- [ ] Active TypeScript and UI terminology uses `school-admin` and “School Admin”; no runtime alias for `superadmin` remains.
- [ ] `TenantRole` excludes Provider Admin and wildcard, while navigation matchers may represent the wildcard separately.
- [ ] A case-insensitive search finds no active runtime or documentation references to `superadmin`, excluding historical `.scratch` material.
