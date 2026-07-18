# Tenant Access Provider Wayfinding Map

## Destination

A decision-complete specification for a tenant-wide access provider that lets authenticated tenant UI present mutation controls as read-only when write access expires, while server-side enforcement remains authoritative and ready to incorporate monthly subscriptions later.

## Notes

- Domain: authenticated tenant access and mutation authorization.
- Use the `grilling` and `domain-modeling` skills when resolving domain or policy decisions.
- The provider wraps the entire authenticated tenant component tree and exposes `isReadOnly` plus a machine-readable reason.
- Initial scope derives access from `trialEndsAt`; subscription storage and billing implementation are out of scope.
- Tenant lookup or access-evaluation failure must fail closed. A valid tenant with `trialEndsAt: null` remains writable under the current policy.
- The UI provider is only a UX mechanism. Client state, disabled controls, and browser time are never security boundaries.
- UI should transition automatically when an open page crosses the trial deadline, but mutation authorization always uses server state and server time.

## Decisions so far

<!-- Closed ticket decisions are indexed here. -->

## Not yet specified

- The implementation sequence and validation plan, after the access policy, provider lifecycle, mutation surface, and UI adoption boundaries are resolved.
- How subscription state will later participate in access evaluation; revisit when the subscription domain exists.

## Out of scope

- Subscription tables, billing-provider integration, renewals, and monthly payment workflows.
- Treating client-side state or disabled styling as authorization enforcement.
