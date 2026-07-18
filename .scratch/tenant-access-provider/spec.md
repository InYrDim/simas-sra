# Tenant Access Provider

Status: ready-for-agent

## Problem Statement

Tenant yang masa trial-nya telah berakhir sudah ditolak oleh protected server action pada proof of concept, tetapi komponen-komponen di authenticated tenant area belum memiliki sumber status akses bersama. Akibatnya, setiap komponen harus mencari atau menghitung status trial sendiri, UI dapat tetap terlihat seolah-olah menerima mutasi, dan definisi read-only berisiko berbeda antara banner, kontrol UI, dan server enforcement.

Status disabled di browser juga tidak cukup untuk mengamankan mutasi. Pengguna dapat mengubah client state dengan React DevTools, menghapus atribut `disabled`, atau memanggil endpoint secara langsung. Tenant membutuhkan pengalaman UI yang konsisten tanpa menjadikan provider client-side sebagai batas keamanan.

Rencana langganan bulanan juga berarti kontrak UI sebaiknya mewakili tenant write access, bukan hanya kondisi trial expired, sehingga sumber akses baru dapat ditambahkan kemudian tanpa mengubah seluruh consumer.

## Solution

Tambahkan tenant access provider yang membungkus seluruh authenticated tenant component tree. Server layout mengevaluasi tenant write access dan memberikan state awal kepada provider. Seluruh komponen tenant dapat menggunakan hook bersama untuk membaca `isReadOnly` dan alasan machine-readable, lalu menerapkan disabled state pada kontrol mutasi yang relevan.

Provider memperbarui state UI secara otomatis ketika halaman yang masih terbuka melewati batas akhir trial. Perubahan client-side ini hanya meningkatkan pengalaman pengguna. Setiap Server Action dan API route yang melakukan mutasi tenant tetap wajib mengevaluasi write access secara independen menggunakan data dan waktu server.

Evaluasi akses menggunakan kebijakan tunggal yang dapat dipakai oleh server layout, protected mutations, dan presentasi trial. Evaluasi gagal secara tertutup ketika tenant tidak ditemukan atau status akses tidak dapat dipastikan. Tenant valid dengan deadline trial `null` tetap writable sesuai perilaku yang berlaku saat ini.

Kontrak akses menggunakan istilah tenant access/read-only dan alasan terstruktur agar nantinya dapat menerima status subscription tanpa mengganti API yang digunakan komponen UI.

## User Stories

1. As a tenant user, I want mutation controls to appear disabled after my trial expires, so that the interface accurately communicates that changes are no longer permitted.
2. As a tenant user, I want read-only pages and data to remain accessible after my trial expires, so that I can still inspect existing information.
3. As a tenant user, I want navigation to remain usable in read-only mode, so that I can move through the application.
4. As a tenant user, I want logout and session controls to remain usable in read-only mode, so that I am never trapped in an authenticated session.
5. As a tenant user, I want renewal, billing, or provider-contact controls to remain usable in read-only mode, so that I can restore write access.
6. As a tenant user, I want the UI to change to read-only when my trial expires while the dashboard is open, so that I do not need to reload to see my current access state.
7. As a tenant user, I want an understandable message when a mutation is rejected, so that I know the trial or access state caused the rejection.
8. As a tenant user, I want all mutation controls to communicate disabled state consistently, so that read-only behavior is predictable throughout the tenant area.
9. As a keyboard user, I want read-only controls to expose appropriate accessible state, so that their behavior is understandable without relying only on visual styling.
10. As a screen-reader user, I want the reason for unavailable mutations to be perceivable, so that disabled controls do not become unexplained dead ends.
11. As a tenant administrator, I want direct requests to mutation endpoints rejected after write access expires, so that browser manipulation cannot bypass the restriction.
12. As a tenant administrator, I want all existing tenant mutation endpoints audited, so that security does not depend on whether a particular UI control uses the provider.
13. As a tenant administrator, I want newly created tenant mutation endpoints to use a reusable enforcement boundary, so that future features do not accidentally bypass read-only policy.
14. As a tenant administrator with no trial deadline, I want existing writable behavior to remain unchanged, so that tenants intentionally configured without an expiry are not locked out.
15. As a provider operator, I want privileged access-management operations excluded explicitly from tenant read-only restrictions, so that I can extend or restore tenant access.
16. As a provider operator, I want missing or unresolvable tenant access to fail closed, so that uncertain authorization never grants mutation access.
17. As a developer building a tenant component, I want to read tenant access through one hook, so that I do not duplicate database queries or date calculations.
18. As a developer building a tenant component, I want a machine-readable read-only reason, so that the component can present relevant guidance without parsing display text.
19. As a developer, I want trial-boundary semantics defined once, so that the banner, provider, and server mutations agree at the exact expiry instant.
20. As a developer, I want server time to remain authoritative for mutations, so that changing the browser clock cannot grant write access.
21. As a developer, I want client state to be treated only as presentation state, so that React DevTools manipulation does not become an authorization vulnerability.
22. As a developer, I want the authenticated tenant layout to supply initial access state, so that rendering does not require an additional client request.
23. As a developer, I want tenant access data fetched once at the layout boundary, so that the provider and trial messaging do not issue redundant queries.
24. As a developer, I want access policy separated from React presentation concerns, so that policy behavior can be verified without rendering components.
25. As a developer, I want deterministic time input at the policy seam, so that boundary conditions can be tested reliably.
26. As a product owner, I want the access contract to accommodate active monthly subscriptions later, so that adding billing does not require rewriting every tenant component.
27. As a product owner, I want subscription implementation excluded from this change, so that the provider can ship without prematurely defining billing behavior.
28. As a security reviewer, I want UI disabling and server authorization documented as separate responsibilities, so that nobody mistakes presentation controls for enforcement.
29. As a security reviewer, I want an expired tenant mutation to return a consistent forbidden-equivalent result, so that all clients handle the denial predictably.
30. As a maintainer, I want the existing trial banner to consume the canonical access evaluation, so that it cannot disagree with the read-only controls.

## Implementation Decisions

- Introduce a canonical tenant access policy as the single source of truth for deciding whether tenant mutations are allowed.
- Keep policy evaluation independent from React so it can serve server layouts, mutation enforcement, and other server-side consumers.
- The policy accepts or otherwise supports a controlled current time for deterministic boundary evaluation, while production mutations always use server time.
- A tenant is writable through the exact trial deadline and becomes read-only after that deadline, preserving the current comparison semantics.
- A valid tenant whose trial deadline is `null` remains writable under the current policy.
- A missing tenant, failed lookup, malformed access state, or otherwise indeterminate evaluation produces read-only access. The implementation must not silently grant write access when evaluation fails.
- Represent access as structured state containing at least `isReadOnly` and a machine-readable reason.
- Initial reasons include trial expiry, unavailable/indeterminate access, and no restriction. The reason model must be extensible for future subscription expiry without requiring changes to provider consumers.
- The authenticated tenant server layout evaluates initial access and wraps the entire authenticated tenant component tree with a client provider.
- The provider exposes a dedicated consumer hook. The hook must fail clearly when used outside its provider rather than returning a permissive default.
- The server layout supplies sufficient deadline information for the provider to transition the UI automatically when the current page crosses the trial deadline.
- The provider may use browser scheduling for timely presentation updates, but browser time and provider state never authorize a mutation.
- The provider must clean up and reschedule its expiry transition when its access inputs change.
- Components decide which individual controls consume `isReadOnly`; the provider must not generically disable an entire DOM subtree.
- Mutation controls use native disabled behavior where supported and appropriate accessible disabled semantics where native disabling is not available.
- Read-only mode must not disable navigation, logout/session management, data viewing, access-recovery paths, provider contact, or future billing/renewal controls.
- Trial messaging and disabled UI should use the canonical access result rather than independently querying and comparing trial dates.
- Every tenant-facing Server Action and API route that mutates tenant data must pass through the canonical server enforcement boundary.
- The existing protected-action abstraction should be evolved or reused rather than introducing competing wrappers for the same policy.
- Protected mutations return a consistent forbidden-equivalent result with a stable structured shape and user-facing explanation.
- Provider/admin operations that manage tenant access are explicit exceptions and must not accidentally inherit tenant self-service read-only restrictions.
- Existing mutation endpoints must be inventoried during implementation. Any endpoint not protected by the canonical enforcement boundary must either adopt it or document why it is a privileged exception.
- No database schema change is required for this feature. Initial access remains derived from existing tenant trial data.
- Future subscription state will be combined inside the canonical tenant access policy. UI consumers will continue to depend on the same read-only contract.

## Testing Decisions

- Tests should assert externally observable access behavior rather than internal React state, implementation-specific timers, database query construction, or private helper calls.
- The primary test seam is the canonical tenant access policy. This is the highest shared seam and should cover active trials, exact deadline equality, expired trials, null deadlines, missing tenants, and access-evaluation failures.
- Policy tests should use a controlled current time rather than waiting for real time to pass.
- Server enforcement tests should verify that a writable tenant reaches the mutation, while a read-only or indeterminate tenant receives the consistent forbidden-equivalent result and the mutation body is not executed.
- Provider tests should verify behavior through a consumer: the initial `isReadOnly` and reason values are exposed correctly, and the consumer changes to read-only when the supplied deadline passes.
- Provider tests should verify that use outside the provider fails clearly instead of defaulting to writable access.
- One representative tenant mutation control should be tested at the integration seam to prove that provider state becomes accessible disabled UI while permitted state remains interactive.
- Accessibility assertions should prefer semantic state such as native `disabled` or `aria-disabled` over checking CSS class names alone.
- Mutation inventory validation should ensure every discovered tenant mutation uses the canonical enforcement boundary or is recorded as a deliberate privileged exception.
- Direct-request behavior must be tested independently from UI disabled behavior, demonstrating that client manipulation cannot bypass server enforcement.
- The repository currently has no established automated test files or test script. Implementation should add the smallest suitable test tooling needed for deterministic policy and React consumer tests, avoiding multiple overlapping frameworks.
- Because there is no local test prior art, existing lint and production build remain supporting validation but do not replace behavioral tests for the access policy.

## Out of Scope

- Subscription database tables or fields.
- Payment provider integration.
- Monthly billing, invoices, renewals, grace periods, failed-payment handling, or cancellation behavior.
- Defining how trial access and paid subscription access combine after the subscription domain is introduced.
- A generic mechanism that disables every element in the authenticated tenant subtree.
- Treating client context, React state, browser time, CSS, or HTML disabled attributes as authorization controls.
- Redesigning the authenticated dashboard beyond the read-only state needed for mutation controls and existing trial messaging.
- Changing the current rule that a valid tenant with a null trial deadline is writable.
- Adding new provider-facing access-management or billing UI.

## Further Notes

- This feature builds on the existing read-only protected-action proof of concept and trial banner.
- The term `isReadOnly` is intentionally preferred over `isTrialExpired`: tenant components care whether mutation is permitted, while trial expiry is only one possible reason.
- React DevTools, DOM editing, or direct HTTP requests can alter or bypass client presentation. This is expected and safe only because every mutation remains protected on the server.
- The Wayfinder map for this effort remains useful as background context, but the feature is sufficiently scoped to proceed through specification, implementation tickets, and test-driven implementation without resolving every decision ticket separately.
