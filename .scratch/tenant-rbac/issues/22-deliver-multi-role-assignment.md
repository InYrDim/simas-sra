# 22 — Deliver multi-role assignment and effective access

**What to build:** A School Admin can safely find eligible Akun Pengguna, replace their complete role set, perform bounded bulk changes, and explain effective access and its source roles.

**Blocked by:** 21 — Deliver Role Tenant lifecycle end to end.

**Status:** resolved

**Implementation:** The Tenant-facing assignment workspace is available at `/settings/assignments` with exact server-side authorization and an authorized navigation entry.

- [x] The directory searches and filters eligible same-Tenant non-admin accounts without revealing foreign accounts or treating unlinked Warga Sekolah as assignable accounts.
- [x] A single-user save atomically replaces the complete active assignment set after revalidating target eligibility, role ownership/status, registry validity, and assignment version.
- [x] Effective access is the deduplicated additive union of active roles and displays every source role, risk, unavailable entitlement, and contextual limitation separately.
- [x] Removing the final role is allowed only after an explicit zero-access warning and mandatory reason; the account receives the approved **Akses belum diberikan** surface.
- [x] Bulk add or revoke supports at most 100 eligible targets, previews unchanged/changed/invalid/zero-role outcomes, and commits all-or-nothing with one batch context and deterministic child audit.
- [x] Inactive accounts cannot receive grants; suspended assignments do not grant access or block role archival.
- [x] Concurrent edits fail with a recoverable stale-state experience and never overwrite or partially apply another administrator's change.
- [x] UI, service, database, isolation, accessibility, and browser tests cover overlapping roles, invalid targets, direct calls, retries, and foreign opaque IDs.
- [x] The Tenant assignment workspace is available at `/<domain>/settings/assignments` and is linked from the Tenant navigation for authorized School Admins.
- [x] The workspace supports role selection, save, bounded bulk changes, loading states, and recoverable stale-state errors.
- [x] Direct access and server actions enforce the exact assignment permissions; unauthorized users receive safe denial.
