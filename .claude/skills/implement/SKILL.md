---
name: implement
description: "Implement a piece of work based on a spec or set of tickets."
disable-model-invocation: true
---

Implement the work described by the user in the spec or tickets.

## Tenant feature preflight

Before implementing Tenant-facing work, check whether the spec or tickets already state whether the feature is:

- Provider-controlled per Tenant,
- inherited from a parent feature or package, or
- universal for every eligible Tenant.

If that decision is not already explicit, invoke `/tenant-feature-gating` and ask the user before writing feature-specific code. Do not invent feature keys or assume the feature is universal.

If the feature is gated, follow `/tenant-feature-gating` for registry design, UI feedback, and server/worker enforcement while implementing.

Invoke `/code-security` whenever the work handles user input, authentication, database queries, file operations, network requests, public endpoints, or workers — gated or not.

Use /tdd where possible, at pre-agreed seams.

Run typechecking regularly, single test files regularly, and the full test suite once at the end.

Once done, use /code-review to review the work.

Commit your work to the current branch.
