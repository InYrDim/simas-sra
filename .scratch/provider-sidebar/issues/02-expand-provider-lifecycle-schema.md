# 02 — Expand the schema for Provider and Tenant lifecycle data

**What to build:** SIMAS can safely persist Provider Admin grants, immutable Pengajuan SIMAS, first School Admin activation, Tenant roles, and Tenant lifecycle timestamps without fabricating lifecycle data for existing Tenants.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] The schema represents the one-to-one Provider Admin grant required by ADR-0001 and rejects invalid grant relationships through constraints and integrity checks.
- [ ] The schema represents immutable Pengajuan SIMAS data, decision metadata, and its one-to-one relationship with an approved Tenant.
- [ ] Tenant and School Admin activation data can represent approval, mandatory credential change, onboarding completion, and Trial Tenant timing.
- [ ] Better Auth supports email/password credentials and persists nullable Tenant role alongside the existing Tenant identifier field.
- [ ] Migration SQL is generated and reviewed in an expand-first order so existing data is not forced into invented NPSN, source Pengajuan, or lifecycle values.
- [ ] A target-data audit or integrity check stops rollout when retained Tenant data requires an explicit reset or backfill policy.
