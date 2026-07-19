# Applicant portal contract and cutover

This runbook completes the applicant identity rollout after every new reader and writer is deployed. The order is mandatory: **expand → backfill → verify → contract**.

## Release evidence

Record command output, operator, UTC timestamp, deployment version, and database backup identifier in the release record.

- [ ] Confirm the expand migrations through `20260719045609_dusty_agent_brand` are applied.
- [ ] Take and restore-test a database backup.
- [ ] Run `pnpm db:audit:applicant-identities` and retain the pre-backfill JSON.
- [ ] Reconcile every ownerless Pengajuan explicitly; never infer ownership from contact snapshots.
- [ ] Run `pnpm db:backfill:applicant-identities <mapping.json>` until it reports zero operations.
- [ ] Run `pnpm db:audit:applicant-identities`; require `"ok": true`, no findings, and retain the activation baseline.
- [ ] Compare the activation baseline count and every timestamp with the pre-rename baseline.
- [ ] Confirm every approved Pengajuan has exactly one linked Tenant and every application-derived Tenant links back to its source Pengajuan.
- [ ] Deploy all current readers and writers, then confirm no calls to anonymous submission, approval-created users/passwords, or `school_admin_activation` remain.
- [ ] Apply `pnpm db:migrate` to install `20260719165658_happy_annihilus`.
- [ ] Run `pnpm db:verify:applicant-cutover` again and retain the post-contract JSON.
- [ ] Check structured security logs and the transactional outbox for unexpected failures or stalled approval events.
- [ ] Record test, typecheck, lint, production-build, concurrency, and browser-journey results.
- [ ] Record the Provider go/no-go decision and approver.

## Staging fixture

The staging rehearsal must contain:

1. a legacy ownerless rejected Pengajuan resolved by an explicit mapping;
2. a rejected and resubmitted binding with deterministic attempt numbers;
3. an approved Pengajuan with a one-to-one source Tenant;
4. a Provider-created School Admin with all temporary-credential timestamps populated;
5. a promoted Pemohon with no temporary-credential activation.

Capture the audit before backfill, after backfill, and after contract. Deliberately verify that ownerless applications, canonical-NPSN collisions, multiple pending applications, invalid identity paths, and inconsistent approval–Tenant links block cutover.

## Rollback boundary

Application rollback is safe only before either of these events:

- the contract migration has been applied; or
- the new approval path has committed a promoted Pemohon/Tenant.

After that boundary, do **not** run the old application against the new schema. Restore service with a forward fix or a reviewed recovery migration. A database restore is allowed only under the release incident plan and must account for all writes after the backup.

## Go/no-go

Choose **no-go** if any audit finding remains, activation history differs, migration rehearsal fails, required validation is incomplete, backup restoration is unproven, or security log/outbox monitoring is unavailable. Otherwise record **go** with the retained evidence above.
