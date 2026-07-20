# Tenant operational model rollout

Use a forward-only `expand → backfill → verify → activate → contract` rollout.

1. Apply the additive Drizzle migration. Existing nullable Tenant fields preserve old-reader behavior.
2. Run `pnpm db:backfill:tenant-operational 100`. Each batch updates its checkpoint atomically and can be resumed with the same command.
3. Inspect the JSON metrics, especially `needsReconciliation` and shadow `differences`.
4. Run `pnpm db:verify:tenant-operational`. Do not activate lifecycle mutations until it reports `ok: true` and all access differences are resolved.
5. Enable lifecycle mutations with `TENANT_LIFECYCLE_MUTATIONS_ENABLED=true` only after verification. Disabling it stops new lifecycle mutations; it must not reverse backfill or later durable lifecycle decisions.

Tenants with a trusted approved source application are marked `active` and `not_required`. Ambiguous legacy links remain `active` for compatibility but are marked `needs_reconciliation`; lifecycle mutation authorization must call `resolveLifecycleMutationAvailability` and fail closed.

The backfill creates no Kasus Penutupan Tenant and no deletion schedule. A valid legacy `settings.deletionWaitingDays` from 1 through 365 is retained; otherwise the default is 30 days.
