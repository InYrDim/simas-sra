# MySQL backup/restore rehearsal

This procedure creates repository-verifiable rehearsal evidence. It does not
prove infrastructure retention, off-site storage, or a production recovery
objective.

## Safety requirements

- The target database name must begin with `simas_restore_rehearsal_`.
- Source and target database identities must differ.
- The target must exist but contain zero tables.
- The operator must set the exact acknowledgement
  `I_ACKNOWLEDGE_THIS_DATABASE_IS_DISPOSABLE`.
- Use dedicated least-privilege source/read and target/restore credentials.
- Never paste database URLs into issue comments, evidence JSON, or command-line
  arguments. Supply them through the process environment or an approved secret
  runner.
- Generated `.sql` and `.evidence.json` files live under
  `.operational-evidence/`. They may contain sensitive data and must not be
  committed. Move real evidence through the approved restricted release store.

Required environment variables:

- `BACKUP_SOURCE_DATABASE_URL`
- `RESTORE_TARGET_DATABASE_URL`
- `BACKUP_RESTORE_DISPOSABLE_TARGET`
- Optional `BACKUP_RESTORE_RUN_NAME`, which must resolve beneath
  `.operational-evidence/`

Run:

```text
pnpm exec tsx scripts/rehearse-mysql-backup-restore.ts
```

The harness uses `spawn` without a shell, keeps passwords out of command
arguments and output, refuses a nonempty target, creates a SHA-256 artifact
record, compares Tenant/rollout/audit counts, and checks each audit head against
its restored terminal event and next sequence. Any failed invariant makes the
command exit nonzero.

The harness intentionally does not delete the target. An operator must retain it
for investigation or remove it using the environment's approved database
procedure after evidence review.

`docs/operations/evidence/backup-restore.synthetic.example.json` is synthetic.
It demonstrates the schema only and is not rehearsal evidence.
