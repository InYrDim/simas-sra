# 30 — Deliver Provider School Admin lifecycle UI

**What to build:** A Provider Admin can safely manage each Tenant's School Admin roster through nomination, proof, authority grant, replacement, disablement, recovery, and audit without crossing into Tenant-managed roles.

**Blocked by:** 17 — Add the transactional security-command foundation; 19 — Project School Admin into dedicated authority.

**Status:** claimed

- [ ] The Provider roster shows active, pending-proof, expired/cancelled-proof, and disabled School Admin entries without omitting unmanaged or legacy-inconsistent Tenants.
- [ ] Nomination and account-control proof grant zero authority; authority is granted only by a separate reauthenticated Provider command after valid proof.
- [ ] Replacement atomically grants the successor, disables only the selected incumbent, revokes incumbent sessions and tokens, validates at least one active usable authority, and records canonical linked audit events.
- [ ] Multiple active School Admins are supported, while ordinary disablement can never remove the final active usable authority of an active Tenant.
- [ ] Credential recovery for active authority and proof-plus-reactivation for disabled authority are distinct workflows; Tenant users cannot invoke either.
- [ ] Email and identity handling does not enumerate another Tenant, Provider Admin, Applicant, or existing account beyond Provider authority.
- [ ] The UI provides consequence previews, mandatory reasons, loaders, accessible dialogs, stale-version recovery, delivery-failure handling, and contextual audit history.
- [ ] Service, database concurrency, Provider authorization, session revocation, accessibility, and browser tests cover all canonical state transitions and races.
