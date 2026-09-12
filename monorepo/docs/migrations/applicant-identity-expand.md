# Applicant identity expand migration

This rollout is intentionally additive. Apply the Drizzle migration before deploying any writer that uses applicant ownership fields. Existing Pengajuan SIMAS writers remain compatible because all new application columns are nullable during expand.

## Audit

Run the audit after applying the expand migration:

```sh
pnpm db:audit:applicant-identities
```

The command exits nonzero when an invariant fails and prints deterministic identifiers for Provider reconciliation. It also records the count and all timestamps from `school_admin_activation` as the baseline for the later temporary-credential migration.

An ownerless Pengajuan is always a blocking finding. The audit and backfill never use `contact_email`, `contact_name`, or other snapshot fields to infer an owner.

## Explicit ownership mapping

After the Provider has reconciled every ownerless Pengajuan, create a local JSON file that is not committed:

```json
[
  {
    "applicationId": "application-id-from-audit",
    "ownerUserId": "verified-existing-user-id"
  }
]
```

Run the transactional backfill:

```sh
pnpm db:backfill:applicant-identities path/to/mapping.json
```

The mapping must cover every ownerless Pengajuan and may only reference existing users and applications. One owner may map only to one canonical NPSN, and one canonical NPSN may map only to one owner. Attempts are assigned by `submitted_at`, then application ID, making the result deterministic. Synthetic idempotency metadata uses the application ID and does not derive identity from snapshot data.

The command uses conditional updates, aborts and rolls back if data changes after planning, and is safe to rerun: an already matching backfill produces zero operations. It prints and evaluates the full audit again after applying changes.

Do not proceed to verify/contract constraints until the audit returns `"ok": true`. Do not run an older application after contract migration; use a forward fix or recovery migration.
