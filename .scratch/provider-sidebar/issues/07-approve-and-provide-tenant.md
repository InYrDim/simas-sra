# 07 — Approve Pengajuan SIMAS and provide a Tenant atomically

**What to build:** A Provider Admin can approve a pending Pengajuan SIMAS by selecting a valid subdomain, atomically providing the Tenant and first School Admin, then seeing the temporary credential exactly once.

**Blocked by:** 06 — Review and reject Pengajuan SIMAS.

**Status:** done

- [x] The review flow suggests a subdomain from the school name but lets the Provider Admin edit and validate it before approval.
- [x] Approval checks Provider access before input, locks the Pengajuan, and rechecks NPSN, subdomain, and School Admin email conflicts inside one transaction.
- [x] A successful approval creates exactly one Tenant, School Admin with `school-admin` Tenant role, Better Auth credential account, activation row, and approved decision relationship.
- [x] Tenant onboarding and trial timestamps remain null immediately after approval.
- [x] The temporary credential uses at least 128 bits of CSPRNG entropy, is hashed with the Better Auth-compatible hasher, and plaintext is displayed only after commit and never persisted or logged.
- [x] Retrying an approved Pengajuan returns the same Tenant as `already-approved` without issuing another credential; approving a rejected Pengajuan returns a conflict.
- [x] Concurrent duplicate approvals produce one winner, map database collisions to safe domain conflicts, and leave no partial Tenant, user, account, activation, or decision state for losers.
