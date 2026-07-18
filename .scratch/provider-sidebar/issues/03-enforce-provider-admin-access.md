# 03 — Provision and enforce Provider Admin access

**What to build:** Operators can grant or revoke Provider Admin access, and Provider server boundaries authorize callers only from a current session plus a valid database-backed Provider Admin grant.

**Blocked by:** 02 — Expand the schema for Provider and Tenant lifecycle data.

**Status:** ready-for-agent

- [ ] Provisioning a user without a Tenant creates one Provider Admin grant and a repeated request returns `already-provisioned` without duplication.
- [ ] Provisioning a missing user or Tenant user fails with a controlled domain result and no partial mutation.
- [ ] Deprovisioning removes only the grant and blocks the same existing session on its next request.
- [ ] Provider access returns discriminated unauthenticated, forbidden, or authorized results and exposes only the minimum serializable Provider principal.
- [ ] Tenant users, users without a Tenant but without a grant, and invalid grant-plus-Tenant states are forbidden.
- [ ] Page, Route Handler, Server Action, and data-access adapters enforce the proper redirect, 401, 403, or controlled authorization error before reading input or data.
- [ ] An operator bootstrap entry point reuses the provisioning operation without accepting or storing passwords or secrets.
