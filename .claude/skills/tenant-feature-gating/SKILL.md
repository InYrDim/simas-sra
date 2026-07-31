---
name: tenant-feature-gating
description: Assess and implement end-to-end feature gating for SIMAS Tenant features. Use whenever adding a new Tenant-facing feature, module, page, menu, action, public endpoint, or worker, even when the user did not mention feature flags. First ask whether Provider should be able to enable or disable the feature per Tenant when that decision is not already explicit. If gating is required, implement registry, hierarchy, UI feedback, server enforcement, worker rechecks, and tests consistently.
---

# Tenant Feature Gating

Use this skill for every new Tenant-facing feature to decide whether it belongs in the per-Tenant feature policy. Do not assume every feature needs a gate.

## Start with the gating question

Before planning or implementing a new Tenant-facing feature, determine whether the request already answers this question:

> Apakah fitur ini perlu dapat diaktifkan atau dinonaktifkan oleh Provider untuk masing-masing Tenant?

If the answer is not explicit, ask the user and wait for the answer before designing feature policy or writing feature-specific code.

Offer concise choices when useful:

1. **Ya, per Tenant** — Provider controls availability for each Tenant.
2. **Ya, mengikuti parent/paket** — the feature inherits another feature or package entitlement.
3. **Tidak** — the feature is universal for every eligible Tenant.

Do not ask again when the user has already said that the feature is universal, premium, package-dependent, Provider-controlled, or limited to selected Tenants.

If the feature is universal, record that decision in the plan and continue without adding feature keys.

## Classify a gated feature

When gating is required, classify every capability before implementation:

- **Parent** — controls an entire functional area.
- **Read** — opens menus, pages, lists, and record details.
- **Write** — creates, edits, transitions, archives, or otherwise mutates data.
- **Download/export** — produces a file or export without mutating domain data.
- **Validation/upload** — accepts and validates uploaded input.
- **Execution/worker** — commits validated work or runs asynchronously.
- **Public** — exposes unauthenticated pages or actions.
- **Display-only** — reveals a panel or visualization without an action.

Use separate child keys when these capabilities must be controlled independently. Do not create child flags that have no independent product meaning.

## Use the central registry

Define feature metadata in:

- `monorepo/config/tenant-features.ts`

Each feature must declare:

- Stable key.
- Indonesian label and description.
- Functional domain.
- Protected route patterns.
- Parent requirements through `requires`.

Keep configuration declarative. Implementation belongs under `monorepo/lib/features/`.

Use the existing policy module:

- `monorepo/lib/features/tenant-feature-policy.ts`

Parent requirements must affect the effective decision even when a child value remains stored as `true`.

For a feature added to an existing deployed module, decide and test its legacy default explicitly. Do not silently break existing Tenant access.

## Produce one effective availability decision

Use:

- `monorepo/lib/features/tenant-feature-availability.ts`
- `monorepo/lib/features/tenant-feature-access-data.ts`

Fetch one availability snapshot per page/request. Do not query the database per button.

Availability combines:

- Effective parent/child policy.
- Tenant lifecycle and trial read-only state.
- Download capability.
- Role/capability where applicable.

Use the reason priority:

1. `provider-disabled`
2. `read-only`
3. Role/capability denial
4. Domain state
5. Pending/loading
6. Input validation

Provider-disabled feedback takes priority because a Tenant user cannot resolve it locally.

## Apply UI feedback

A disabled feature should be understandable before the user triggers a request.

### Parent or read feature

- Keep its Tenant navigation item visible.
- Render it gray, disabled, and locked.
- Add a tooltip saying Provider disabled it.
- Keep page/layout enforcement for direct URLs.

Navigation implementation lives in:

- `monorepo/components/tenant-nav-menu/`

### Action child feature

- Keep the action visible.
- Disable the button, form trigger, switch, upload, or download control.
- Add an explanatory tooltip.
- Keep unrelated read actions active.
- Preserve loading indicators when the feature is enabled.

Use the reusable feedback seam:

- `monorepo/components/features/feature-action.tsx`
- `featureAvailability` on `monorepo/components/ui/button.tsx`

Example:

```tsx
<Button featureAvailability={availability.ulanganWrite} type="submit">
  Mulai Ulangan
</Button>
```

For dialog triggers, wrap the complete enabled trigger with `FeatureAction`; do not put a tooltip wrapper inside a primitive trigger's `render` prop.

For disabled links, ensure the disabled version has no `href`.

For disabled native buttons, use a focusable wrapper as the tooltip trigger because disabled controls may not emit hover or focus events.

### Public feature

- Disable the preview/open-public-page action in authenticated Tenant UI.
- Keep the unauthenticated endpoint fail-closed.
- Do not expose internal feature configuration or Tenant existence through public errors.

### Display-only feature

Render a locked state with an Indonesian explanation instead of an empty panel or 403.

## Invoke code-security alongside gating

Feature gating is not a substitute for security review. Invoke `/code-security` whenever the gated feature includes user input, authentication, database operations, file upload/download, public endpoints, network requests, or workers.

Remember that:

- An enabled feature does not mean the actor holds the correct role.
- An enabled feature does not mean a record belongs to the requesting Tenant.
- A disabled UI control is not a security boundary.
- An enabled public feature does not mean public input is safe.
- A worker must still validate the feature, ownership, and payload before acting.

## Keep backend enforcement

UI feedback is not a security control.

Every gated operation must still be checked at the server seam:

- Page/layout for read access.
- Server action for mutations.
- Route handler for upload/download/public access.
- Worker immediately before execution.
- Record ownership after Tenant access is established.

Use:

- `monorepo/lib/features/tenant-feature-route-access.ts`

Do not trust Tenant IDs, feature flags, or capability claims sent by the client. Re-resolve Tenant and effective feature state on the server.

Preserve non-disclosure behavior for cross-Tenant and public resources.

## Audit all triggers

Before declaring a gated feature complete, search for all ways it can be triggered:

- Navigation items.
- Links and buttons.
- Forms and dialog triggers.
- Switches and checkboxes.
- Upload inputs.
- Download/export links.
- Server actions.
- Route handlers.
- Public forms and status checks.
- Workers and queued execution.

Map each UI trigger to its backend target. A feature is incomplete if the UI and backend decisions differ.

## Test through stable seams

At minimum test:

- Child active with writable lifecycle.
- Child active with read-only lifecycle.
- Child disabled with writable lifecycle.
- Parent disabled while child is stored active.
- Provider-disabled reason takes priority over read-only.
- Direct server request is still denied.
- Public child is fail-closed.
- Download child follows download capability independently of write.
- Worker rechecks the effective feature before committing work.
- Legacy default is intentional for existing features.

Run focused tests first, followed by diagnostics and `git diff --check`.

## Completion checklist

- [ ] The user explicitly decided whether the feature is gated.
- [ ] Registry metadata and hierarchy are complete, or the feature is recorded as universal.
- [ ] One effective availability snapshot drives UI feedback.
- [ ] Parent/read navigation is visible but disabled when unavailable.
- [ ] Every action child trigger is disabled with a tooltip.
- [ ] Loading states still work when enabled.
- [ ] Server actions and route handlers recheck the feature.
- [ ] Public access is fail-closed without information leakage.
- [ ] Workers recheck before execution.
- [ ] Tests cover parent, child, lifecycle, and direct-request behavior.
