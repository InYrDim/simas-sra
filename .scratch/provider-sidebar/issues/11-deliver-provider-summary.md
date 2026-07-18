# 11 — Deliver the Provider operational summary

**What to build:** A Provider Admin opening `/provider` immediately sees actionable operational counts and recent records, with a direct path to pending Pengajuan SIMAS.

**Blocked by:** 06 — Review and reject Pengajuan SIMAS; 10 — Manage and inspect provided Tenants.

**Status:** resolved

- [x] The summary shows counts for pending review, provided Tenants, Tenants waiting for onboarding, and trials ending within seven days.
- [x] At most five most recent Pengajuan SIMAS and five most recent Tenants are shown using guarded Provider read models.
- [x] The primary **Lihat Pengajuan** action opens the Pengajuan tab at `/provider/tenants?tab=applications`.
- [x] The summary does not duplicate the complete Tenant list or expose a direct create-Tenant action.
- [x] Page-level data access independently enforces Provider authorization rather than relying only on the shell layout.
