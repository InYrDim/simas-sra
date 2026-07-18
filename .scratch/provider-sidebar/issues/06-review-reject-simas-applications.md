# 06 — Review and reject Pengajuan SIMAS

**What to build:** A Provider Admin can find and inspect Pengajuan SIMAS, understand current NPSN or email conflicts, and reject a pending application with a required reason while terminal decisions remain immutable.

**Blocked by:** 04 — Introduce the guarded Provider shell and real navigation routes; 05 — Accept immutable Pengajuan SIMAS.

**Status:** ready-for-agent

- [ ] The Pengajuan tab supports search, status filtering, sorting, pagination, and the specified Indonesian status labels.
- [ ] Each Pengajuan has a guarded, refresh-safe detail route showing all immutable original data and current conflicts against relevant Pengajuan or Tenants.
- [ ] Rejection checks Provider access before input or mutation, locks the pending decision, and requires a non-empty reason.
- [ ] Rejection records decision time and Provider Admin identity without creating a Tenant, user, credential, or activation record.
- [ ] Approved and rejected decisions cannot be edited, reopened, undone, or transitioned again.
- [ ] Direct data access and mutation attempts by unauthorized callers are rejected independently of the Provider layout.
