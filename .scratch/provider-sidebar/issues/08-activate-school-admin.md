# 08 — Activate the first School Admin securely

**What to build:** The first School Admin can use the temporary credential to authenticate, must replace it before using Tenant functionality, and receives safe reset behavior appropriate to whether the first login has happened.

**Blocked by:** 07 — Approve Pengajuan SIMAS and provide a Tenant atomically.

**Status:** ready-for-agent

- [ ] Successful email/password authentication records first authentication idempotently for users with a School Admin activation record.
- [ ] While credential change is required, server guards permit only password change and sign-out and reject Tenant features and onboarding completion.
- [ ] Password change verifies the previous password, uses the Better Auth-compatible hasher, revokes other sessions, and clears the requirement idempotently.
- [ ] Before first authentication, a Provider Admin can reset the temporary credential transactionally, revoke sessions, and see the replacement plaintext only once after commit.
- [ ] After first authentication, temporary credential reset is denied and the UI directs the Provider Admin to the normal Better Auth password recovery flow.
- [ ] Approval, first login, password change, and temporary credential reset do not start Trial Tenant or set onboarding timestamps.
