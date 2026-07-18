# 01 — Separate Tenant navigation and adopt School Admin terminology

**What to build:** Tenant users continue to see their existing navigation through a dedicated Tenant-only sidebar, now with a scoped deep-navy theme and School Admin terminology. Provider concepts must not enter Tenant role or navigation types.

**Blocked by:** None — can start immediately.

**Status:** resolved

- [x] Tenant navigation uses explicit Tenant-only sidebar, menu renderer, configuration, and types while preserving all existing labels, destinations, grouping, submenus, and ordering except the required role rename.
- [x] The Tenant sidebar uses a scoped deep-navy theme with accessible foreground, hover, active, border, and focus states that do not affect Provider or global styling.
- [x] Active TypeScript and UI terminology uses `school-admin` and “School Admin”; no runtime alias for `superadmin` remains.
- [x] `TenantRole` excludes Provider Admin and wildcard, while navigation matchers may represent the wildcard separately.
- [x] A case-insensitive search finds no active runtime or documentation references to `superadmin`, excluding historical `.scratch` material.

## Answer

Introduced dedicated Tenant navigation components, configuration, and types; scoped a deep-navy token set to `TenantSidebar`; and migrated active role terminology to School Admin. Provider layout no longer consumes Tenant navigation.

Validation: TypeScript and targeted ESLint pass. The full build compiles and type-checks, then fails while prerendering the pre-existing `/provider-sidebar-prototype` route because `useSearchParams()` is not wrapped in Suspense. Full ESLint remains blocked by pre-existing errors in analytics, carousel, and mobile-hook files.
