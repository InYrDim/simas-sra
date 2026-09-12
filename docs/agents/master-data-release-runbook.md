# Tenant Master Data release runbook

## Purpose

Use this runbook before widening Tenant Master Data feature flags. Promotion is based on completed evidence, not elapsed time.

## Required evidence

For the candidate release, record the commit SHA and attach results for:

1. `pnpm --dir monorepo test`
2. `pnpm --dir monorepo typecheck`
3. `pnpm --dir=monorepo exec eslint .`
4. The real-MySQL integration suite against two isolated Tenants.
5. `pnpm --dir monorepo db:reconcile:master-data <safe-snapshot.json>`.
6. The critical browser checklist: authorization, cross-Tenant denial, create/edit/conflict, archive/reactivation, mobile list/detail, Rombel membership and Wali Kelas, and the complete Siswa/Guru/Staf import flow.
7. A backup restore drill into an isolated database.
8. A targeted repair dry-run against a copy of production data.

Do not include raw identifiers, spreadsheet cell payloads, before/after audit payloads, credentials, or protected-file contents in evidence.

## Activation stages

Advance only when all evidence above is green for the current commit and no stop condition is open:

1. Internal/demo Tenant.
2. One Tenant pilot with read and write enabled; imports remain disabled.
3. Import pilot for the same Tenant after storage retention and both workers are verified.
4. Small Tenant cohort.
5. General activation.

There is no minimum duration for a stage. Any code, schema, configuration, or worker change invalidates the affected evidence and requires it to be rerun.

## Feature controls

Change controls independently and verify server behavior after every change:

- Master Data read flag.
- Master Data write flag.
- Import template download flag.
- Import validation flag.
- Import execution flag.
- Import worker emergency stop.

Never use menu visibility as authorization evidence. Verify direct URLs and mutations with an unauthenticated user, a non-School-Admin Tenant user, the correct School Admin, and a School Admin from a second Tenant.

## Emergency stop and rollback

1. Stop new import rows with the worker emergency stop. Allow the current row transaction to finish.
2. Disable import execution, then write, then read only as required by the incident.
3. Roll back the application to the last verified commit. Do not run destructive down migrations.
4. Run reconciliation and identify the affected Tenant and safe record IDs.
5. Execute only an approved targeted repair. Run it first in dry-run mode and retain before/after counts.
6. Re-run reconciliation and the affected critical journeys before restoring flags.

A database-wide restore is not the normal rollback path. Use the tested backup restore only for disaster recovery, restore into isolation first, and reconcile before reconnecting traffic.

## Immediate stop conditions

Stop rollout and disable the affected capability immediately for any:

- Cross-Tenant access or relationship.
- Unauthorized mutation.
- Corrupted or missing lifecycle/history/audit evidence.
- Import row committed more than once.
- Destructive migration requirement.
- Duplicate reserved identity or identifier.
- Unreconciled data loss or overview count drift.

Do not resume until the root cause is fixed, targeted repair is verified, and all invalidated evidence is green again.

## Manual browser checklist

Run at desktop and mobile viewport sizes against Tenant A and Tenant B:

- Tenant A School Admin can open `/master`; Tenant B data never appears.
- Anonymous access redirects to login with return destination.
- A non-School-Admin gets `403`; unknown/mismatched domains and cross-Tenant records get `404`.
- Create and edit one record, then submit a stale version and observe a conflict without losing entered values.
- Archive and reactivate one eligible record; verify history remains and related records are not cascaded.
- Open list/detail on mobile and return to the same URL-backed search/filter/page state.
- Assign/transfer a Siswa and replace a Wali Kelas; verify effective-dated history.
- Download, validate, review, decide, execute, retry, and download results for one import; verify no Akun Pengguna is created.
- Verify read-only Tenant states disable mutation server-side and that suspended Tenants cannot download templates.
