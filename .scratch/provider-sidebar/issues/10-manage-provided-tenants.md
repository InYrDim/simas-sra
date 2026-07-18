# 10 — Manage and inspect provided Tenants

**What to build:** A Provider Admin can find provided Tenants, inspect their source Pengajuan SIMAS and lifecycle state, open their public site without impersonation, and reset a temporary credential only while policy allows.

**Blocked by:** 07 — Approve Pengajuan SIMAS and provide a Tenant atomically; 08 — Activate the first School Admin securely; 09 — Complete Onboarding Tenant and start Trial Tenant once.

**Status:** ready-for-agent

- [ ] The Tenant tab supports search by school name, NPSN, subdomain, or first School Admin email, plus lifecycle filtering, date/name sorting, and pagination.
- [ ] Tenant results show school name, NPSN, subdomain, first School Admin, usage stage, approval date, and working detail/open-site actions.
- [ ] Opening a Tenant site does not create a Tenant session or impersonate a Tenant user.
- [ ] A guarded, refresh-safe detail route shows Tenant identity, first School Admin and account status, approval, onboarding, trial period, and source Pengajuan summary.
- [ ] Temporary credential reset is available and returns a one-time result only before first authentication; afterward the detail page points to ordinary password recovery.
- [ ] The first release exposes no edit, delete, suspend, trial extension, feature management, direct Tenant creation, or impersonation action.
