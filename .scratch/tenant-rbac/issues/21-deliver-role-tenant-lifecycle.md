# 21 — Deliver Role Tenant lifecycle end to end

**What to build:** A School Admin can discover and manage Tenant-owned roles from creation through archive using the system permission catalog, with complete server enforcement, accessible UI feedback, impact previews, and audit history.

**Blocked by:** 17 — Add the transactional security-command foundation; 18 — Introduce the centralized evaluator in shadow mode; 20 — Backfill legacy non-admin access without widening.

**Status:** resolved

- [x] School Admin can list and inspect active, draft, and archived roles while non-School-Admin users and foreign Tenant principals cannot access the operations.
- [x] School Admin can create from scratch or a Template Role Tenant, copy an eligible role, normalize and validate a unique non-reserved name, and persist only concrete `tenant-assignable` permissions.
- [x] Permission dependencies, invalid/deprecated keys, risk confirmations, and minimum active-role composition are enforced server-side and explained in the UI.
- [x] Rename, permission edit, activate, move to draft, archive, and restore follow the approved state machine and optimistic version contract.
- [x] Active-role changes show authoritative affected-user and permission impact; roles with active assignments cannot be deactivated or archived silently.
- [x] Every successful mutation records canonical before/after, diff, reason where required, version, actor, and affected count atomically.
- [x] The responsive role workspace includes action-specific loaders, empty/error/stale states, keyboard and screen-reader support, safe destructive focus, and recoverable conflicts.
- [x] Service, database, entry-point, accessibility, and browser tests prove direct calls cannot bypass the UI.
