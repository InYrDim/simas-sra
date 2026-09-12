# Portal Pemohon dan Akses Tenant

Status: ready-for-agent

## Problem Statement

Calon sekolah saat ini dapat mengirim Pengajuan SIMAS tanpa akun, sehingga Pengajuan tidak mempunyai pemilik autentikasi yang kanonis. Ketika Pengajuan disetujui, sistem membuat School Admin baru dan menerbitkan Kredensial sementara berdasarkan snapshot kontak. Perilaku ini memutus kesinambungan identitas Pemohon, membuat riwayat pengajuan ulang sulit dimiliki secara aman, dan tidak menyediakan portal tempat Pemohon dapat memantau status atau menemukan kembali Tenant setelah approval.

Routing autentikasi juga belum membedakan secara lengkap antara Provider Admin, Pemohon, School Admin hasil promosi, dan anggota Tenant lain. Login pusat hanya membedakan user dengan atau tanpa Tenant, sementara login khusus Tenant, intent `/apply`, perlindungan callback, invalid identity, dan pencabutan sesi setelah promosi belum mempunyai kontrak terpadu.

Sistem membutuhkan portal `/apply` berbasis akun dengan kepemilikan Pengajuan yang permanen, state machine yang jelas, transaksi approval atomik yang mempromosikan user existing, serta batas autentikasi yang mencegah perpindahan tidak sah antar-Provider, Pemohon, dan Tenant. Perubahan harus dapat dimigrasikan tanpa menebak kepemilikan data lama, tanpa menghasilkan state parsial, dan dengan perlindungan database terhadap duplikasi maupun konkurensi.

## Solution

SIMAS menyediakan perjalanan publik yang dimulai dengan registrasi Pemohon. Registrasi membuat identitas autentikasi dan jalur Pemohon, tetapi belum mengikat akun ke sekolah. Ketika Pengajuan SIMAS pertama dikirim, sistem mengikat Pemohon secara permanen dan unik ke satu NPSN serta menyimpan Pengajuan sebagai snapshot immutable milik user tersebut. Pengajuan ulang setelah rejection membuat record baru dengan nomor percobaan berikutnya; Pengajuan lama tetap menjadi riwayat.

Portal `/apply` menghitung tampilan dari identitas user dan Pengajuan terakhir. Pengunjung anonim memperoleh pengantar dan tindakan registrasi/login. Pemohon melihat empty state, pending read-only, atau rejection beserta alasan dan tindakan pengajuan ulang. Ketika Provider Admin menyetujui Pengajuan, satu transaksi menyediakan Tenant, mempromosikan user Pemohon yang sama menjadi School Admin, mempertahankan password, mencabut semua sesi, menghubungkan Tenant dengan Pengajuan sumber, dan menyimpan keputusan final. School Admin kemudian dapat kembali ke `/apply` untuk melihat riwayat dan menemukan tautan Tenant.

Routing autentikasi dihitung server-side dari satu resolver identitas. Provider Admin menuju `/provider`, Pemohon dan School Admin hasil promosi yang masuk melalui perjalanan pusat menuju `/apply`, dan anggota Tenant lain menuju dashboard Tenant mereka. Login khusus Tenant menggunakan domain hanya sebagai konteks; relasi user–Tenant tetap menentukan akses. Intent dan tujuan lanjutan dibatasi secara ketat agar tidak menjadi open redirect atau bukti otorisasi.

Schema dan aplikasi dipindahkan melalui cutover expand, backfill, verify, dan contract. Data lama diaudit lebih dahulu. Pengajuan tanpa pemilik tidak dipetakan dari email kontak secara otomatis, melainkan harus direkonsiliasi secara eksplisit. Constraint database, transaksi dengan urutan lock kanonis, idempotency key, dan update status bersyarat menjadi pertahanan utama terhadap submit atau approval bersamaan.

## User Stories

1. As an anonymous visitor, I want to understand the purpose of the `/apply` portal, so that I can decide whether to register or sign in.
2. As an anonymous visitor, I want the portal registration link to retain my apply intent, so that I return to the applicant journey after registering.
3. As an anonymous visitor, I want the portal login link to retain my apply intent, so that I return to the correct journey after authentication.
4. As a prospective school representative, I want to create a Pemohon account with my own password, so that I can securely own and revisit my Pengajuan SIMAS.
5. As a newly registered Pemohon, I want to see that I have not submitted an application yet, so that I know the next action to take.
6. As a Pemohon, I want my account to remain unbound to a school until my first submission, so that incomplete form entry does not reserve an NPSN.
7. As a Pemohon, I want my first successful submission to bind my account permanently to one NPSN, so that ownership of the school journey is unambiguous.
8. As a school, I want one canonical NPSN to be owned by at most one Pemohon, so that duplicate applicants cannot create competing school identities.
9. As a Pemohon, I want an NPSN conflict to reveal no information about another account, so that applicant privacy is protected.
10. As a Pemohon with an ownership dispute, I want to be directed to Provider support, so that the dispute is handled through an auditable manual process.
11. As a Pemohon, I want each submission to preserve the school and contact details as an immutable snapshot, so that Provider decisions can be audited against what was submitted.
12. As a Pemohon, I want my user identity rather than the contact email snapshot to own the application, so that changing contact details does not change authorization.
13. As a Pemohon, I want a successful submission to show a stable application identifier, so that I can refer to it when requesting support.
14. As a Pemohon, I want repeated delivery of the same submission request to return the same application, so that retries do not create duplicates.
15. As a Pemohon, I want reuse of an idempotency key with different data to be rejected, so that accidental request corruption is visible.
16. As a Pemohon with a pending application, I want to see its status and submitted snapshot, so that I know exactly what Provider is reviewing.
17. As a Pemohon with a pending application, I want the application to be read-only and non-cancellable, so that the review target remains stable.
18. As a Pemohon, I want to see my complete application history ordered by attempt number, so that retries are understandable even when timestamps are close.
19. As a Pemohon whose application was rejected, I want to see a mandatory Provider reason, so that I understand why it was rejected.
20. As a rejected Pemohon, I want to submit a new application immediately for the same NPSN, so that I can correct the information without waiting.
21. As a rejected Pemohon, I want resubmission to create a new record, so that the rejected snapshot and decision remain immutable.
22. As a Pemohon, I want at most one pending application for my school, so that concurrent clicks or requests cannot create ambiguous active reviews.
23. As a Provider Admin, I want to review the immutable application snapshot and history, so that I can make an informed, auditable decision.
24. As a Provider Admin, I want rejection to require a non-empty reason, so that the Pemohon always receives actionable context.
25. As a Provider Admin, I want a suggested Tenant domain derived from the school name, so that provisioning starts with a useful default.
26. As a Provider Admin, I want to choose and validate the final unique Tenant domain, so that every Tenant has an unambiguous entry point.
27. As a Provider Admin, I want approval to fail cleanly when the domain is already used, so that I can choose another domain without partial provisioning.
28. As a Provider Admin, I want an existing Tenant for the same NPSN to be treated as a data conflict, so that the system does not silently duplicate a school.
29. As a Provider Admin, I want approval to promote the application owner rather than the snapshot contact, so that the correct authenticated identity becomes School Admin.
30. As a promoted School Admin, I want to retain my existing password and account, so that approval does not force me to manage a second identity.
31. As a promoted School Admin, I want approval not to issue a temporary credential, so that my established credential remains the only expected password.
32. As a promoted School Admin, I want my previous sessions revoked at approval, so that stale sessions cannot retain Pemohon privileges.
33. As a promoted School Admin, I want to sign in again after approval, so that my session contains the new Tenant identity and role.
34. As a promoted School Admin, I want `/apply` to show approval, history, and my server-derived Tenant link, so that I can recover the Tenant domain later.
35. As a promoted School Admin, I want to be prevented from submitting another Pengajuan, so that approval remains final.
36. As a Provider Admin, I want identical approval retries to return the existing Tenant, so that network retries are safe.
37. As a Provider Admin, I want a different approval request after a final decision to be rejected as a conflict, so that final state cannot be overwritten.
38. As an operator, I want approval, Tenant provisioning, user promotion, session revocation, decision recording, and outbox creation to commit or roll back together, so that no partial state can escape.
39. As an operator, I want notification delivery to happen after approval commits, so that messaging failure cannot undo a valid approval.
40. As a Provider-created School Admin, I want the existing temporary-credential onboarding flow to continue, so that administrative account creation remains supported.
41. As a Provider-created School Admin, I want to be forced to change a temporary password before using the Tenant, so that the Provider-issued secret is not permanent.
42. As a Provider-created School Admin, I want temporary credential reset to be available only before my first successful authentication, so that later recovery uses the normal password flow.
43. As a Provider Admin, I want temporary-credential status to appear only for accounts created through that path, so that promoted Pemohon are not incorrectly shown as awaiting first login.
44. As an authenticated Provider Admin using central login, I want to be routed to `/provider`, so that applicant intent cannot redirect me into the wrong portal.
45. As an authenticated Pemohon using central login, I want to be routed to `/apply`, so that I can continue my application journey.
46. As a promoted School Admin entering through central login, I want to reach `/apply` first, so that I can see the approval result and recover my Tenant link.
47. As a Tenant member using central login, I want to be routed to my Tenant dashboard, so that I reach the workspace I am authorized to use.
48. As an authenticated user opening login or registration, I want to be redirected according to my identity, so that I cannot accidentally mix accounts without logging out.
49. As a security operator, I want unknown intents and callback-like parameters ignored and logged, so that open-redirect attempts are observable without affecting users.
50. As a user with no valid identity path or multiple identity paths, I want a safe access-error page with logout and support contact, so that the system does not guess unsafe authorization.
51. As an anonymous user opening Provider pages, I want to be sent to central login, so that I can authenticate through the correct entry point.
52. As an anonymous user opening protected `/apply` functionality, I want to be sent to central login with apply intent, so that I can resume the applicant journey.
53. As an anonymous user opening a Tenant area, I want to be sent to that Tenant's login page, so that the Tenant context is retained.
54. As a Tenant user, I want the requested domain to be resolved exactly before a login form appears, so that I do not submit credentials to an unknown Tenant context.
55. As a visitor to an unknown Tenant domain, I want to see “Tenant tidak ditemukan” without a login form, so that the system does not imply the Tenant exists.
56. As a Tenant member signing in through my own domain, I want to reach that Tenant's dashboard, so that I can begin work.
57. As a Tenant member signing in through another Tenant's domain, I want to be routed to my own Tenant without gaining access to the requested Tenant, so that domain selection cannot elevate access.
58. As a Pemohon signing in through a Tenant login page, I want to be routed to `/apply`, so that a Tenant entry point does not change my identity path.
59. As a Provider Admin signing in through a Tenant login page, I want to be routed to `/provider`, so that a Tenant entry point does not change my privileges.
60. As a Tenant member, I want a valid continuation path within the same Tenant to be preserved, so that I can resume an authorized page after login.
61. As a Tenant member, I want absolute, cross-Tenant, encoded, Provider, and applicant continuation targets ignored, so that login cannot be used as an open redirect or authorization bypass.
62. As an operator, I want legacy applications audited before ownership constraints become mandatory, so that migration never invents owners from contact snapshots.
63. As an operator, I want unresolved legacy ownership to stop deployment with specific application IDs, so that reconciliation is explicit and reviewable.
64. As an operator, I want the temporary activation rename to preserve every existing record and timestamp, so that historical onboarding data is not lost.
65. As an operator, I want schema migration to proceed through expand, backfill, verify, and contract phases, so that application and database cutover remain compatible.
66. As an operator, I want database constraints to enforce unique ownership, attempt ordering, idempotency, and one pending application, so that correctness does not depend on UI behavior.
67. As an operator, I want all competing school operations to use a canonical lock order, so that concurrent submit, rejection, and approval serialize safely.
68. As a security reviewer, I want authorization checked inside every server query and action, so that hiding UI controls is never the only defense.

## Implementation Decisions

- `user` remains the single authentication identity. Every user must resolve to exactly one identity path at a time: Provider Admin, Pemohon, or member of one Tenant. Zero or multiple paths are invariant violations.
- A dedicated Pemohon record marks the public identity path immediately at registration, including before the first Pengajuan. Public registration creates a user, credential account, and Pemohon marker atomically and never accepts a role from the client.
- A separate Pemohon–school binding stores the permanent relationship between one user and one canonical NPSN. Both user and canonical NPSN are unique. Rejection and promotion do not remove this historical binding.
- The first submission creates the binding and first Pengajuan in one transaction. Later submission is allowed only when the latest final Pengajuan is rejected.
- Each Pengajuan stores immutable owner, binding, attempt number, idempotency key, payload hash, and school/contact snapshot. Attempt numbers are positive, monotonic per binding, and unique with the binding.
- Idempotency keys are unique per owner. A retry with the same key and payload hash returns the existing Pengajuan; a changed payload with the same key is a conflict.
- NPSN is normalized and validated before a transaction. Canonical NPSN controls ownership and conflict checks; snapshot values exist for historical presentation and do not control authorization.
- MySQL enforces one pending Pengajuan per binding through a generated nullable binding value for pending rows and a unique index on that generated value. The implementation must not assume partial-index support.
- Database decision checks preserve the three legal states: undecided pending, approved with Provider decision and Tenant, or rejected with Provider decision and non-empty reason.
- Status transitions are limited to `pending → rejected` and `pending → approved`. Writers use conditional updates against pending state. Final snapshots, ownership, attempt identity, and decisions are immutable.
- All school-scoped mutations use the same lock order: binding, Pengajuan, user, then related records. State and identity are revalidated after locks are acquired.
- Cross-table identity exclusivity is enforced by a single identity service and transactional locks because ordinary MySQL checks cannot inspect other tables. The identity resolver independently detects invalid persisted combinations.
- `/apply` derives a closed state union server-side: anonymous, Pemohon without Pengajuan, pending, rejected, or School Admin. Form drafts are not domain records and are not persisted.
- Pending Pengajuan cannot be edited or cancelled. Rejection requires a reason and enables immediate creation of a new record for the same binding. There is no waiting period or attempt limit.
- Approval has no separate durable portal state beyond School Admin identity. The approved Pengajuan remains in immutable history and points one-to-one to its Tenant.
- Approval is one database transaction that validates the pending Pengajuan, owner, binding, NPSN, domain, identity path, and Tenant conflicts; creates the Tenant; promotes the existing user; revokes sessions; records Provider decision and time; links the source Pengajuan; finalizes status; and writes any audit/outbox event.
- Approval uses the user owner of the Pengajuan, never snapshot contact email. It retains the existing user ID, authentication account, password, and historical ownership relations.
- Promotion removes the active Pemohon identity marker and assigns the same user as School Admin of the new Tenant. The permanent school binding and Pengajuan history remain available for audit and portal display.
- Approval does not create a user, password account, temporary secret, or temporary-credential activation. Any existing implementation that does so is replaced only after promotion tests pass.
- Domain is selected by Provider Admin, initially suggested from school name, normalized, validated, and globally unique. A used domain aborts approval while leaving the Pengajuan pending. An existing Tenant for the NPSN is a data conflict requiring investigation.
- Approval retry is idempotent only when it asks for the identical result, especially the same domain. A changed request after a final decision is a conflict.
- Rejection and approval both record the Provider Admin and decision time. Rejection of a final record or approval after rejection is a conflict rather than an overwrite.
- Session records for the promoted user are deleted inside the approval transaction. The user must authenticate again before entering the Tenant.
- Notification delivery does not determine approval success. An outbox or audit record is written transactionally and delivery occurs after commit.
- The activation model is renamed from School Admin activation to temporary-credential activation because only Provider-created School Admin accounts use it. Existing rows and all historical timestamps migrate one-to-one.
- Only a user with a temporary-credential activation whose password-change flag is true is routed to password change. Promoted School Admin users have no activation and proceed without that detour.
- Temporary credential reset is available only for Provider-created accounts before first successful authentication. Later recovery and all promoted Pemohon use normal password recovery.
- School Admin origin is derived from canonical relations rather than a new origin column: temporary activation indicates Provider creation, while ownership of the Tenant source Pengajuan indicates Pemohon promotion. Formation operations keep these paths exclusive.
- One server-only identity resolver loads the Provider, Pemohon, Tenant, role, and temporary-activation relations and returns Provider Admin, Pemohon, Tenant member, or invalid. Routing and guards use this resolver rather than reimplementing identity inference.
- One central destination resolver maps valid identity to Provider, applicant, Tenant dashboard, or required password change. Invalid identity maps to a safe access-error destination.
- Central login and registration accept only an internal `apply` intent enum. The intent preserves journey context but is neither a URL nor authorization evidence. Identity always overrides intent.
- Central authentication does not accept arbitrary callback URLs. Absolute, protocol-relative, encoded, unknown, or alternate-path values are ignored and recorded in structured security logs without being reflected to the user.
- An authenticated user opening login or registration is routed by identity and must log out before changing accounts.
- Anonymous entry points are distinct: applicant portal uses central login with apply intent, Provider uses central login, and protected Tenant areas use the corresponding Tenant login.
- Authenticated but unauthorized users are not treated as anonymous. They are routed to their valid identity destination or to access error when identity is invalid.
- Tenant login resolves the requested domain by exact server-side match before showing a form. Unknown domains display a not-found message and no credential form; no default Tenant or school-name lookup is attempted.
- Credentials authenticate a global user. Membership relations authorize Tenant access; the requested domain is context only and never evidence of membership.
- All Tenant roles share the Tenant dashboard landing page. Subsequent menu, page, and action access remains role-restricted.
- Tenant login may preserve only a relative continuation path beginning with the exact requested Tenant prefix. Authorization is still checked after login. Unsafe or cross-context values fall back to the authenticated user's legitimate destination.
- The portal submission action accepts snapshot fields and a per-render idempotency key. It derives owner, binding, attempt, and status exclusively from the session and database.
- Submission returns discriminated outcomes for validation errors, privacy-safe NPSN conflict, existing pending, idempotency conflict, and success. Success revalidates or redirects to the server-derived portal state.
- Provider approval success no longer returns or displays a temporary credential. Provider UI distinguishes promoted users with an existing account password from Provider-created users using temporary credentials.
- The access-error page exposes only a safe explanation, Provider contact, and logout. Technical invariant details are restricted to structured server logs.
- Migration follows expand, backfill, verify, and contract. New nullable structures and compatible writers are deployed first; explicit mapping backfills legacy ownership; invariant audits must pass before non-null and unique constraints activate; readers then move; obsolete contracts are removed last.
- Legacy ownership must never be inferred automatically from contact email. If ownerless applications exist, deployment stops and reports identifiers for explicit Provider reconciliation.
- The migration rename must preserve the count and values of all temporary-activation records. No activation record is synthesized for a School Admin without one.
- Application deployment requiring new schema cannot precede expand migration. Contract migration cannot precede all new readers and writers. After new approvals or contract migration, rollback uses a forward fix or recovery migration rather than running the old application against the new model.
- Implementation order is: characterization tests; expand/audit/backfill migration; identity and destination resolvers; stateful applicant portal and submit transaction; Provider decision transactions and UI; Tenant login and guards; schema verification/contract; full release validation.

## Testing Decisions

- Tests assert externally visible behavior through the highest practical seam. They do not assert private helper calls, SQL statement order as an implementation detail, component internals, or incidental markup.
- The primary seam is the public contract of server-side application services: identity and destination resolution, applicant portal query, application submission, Provider rejection/approval, and Tenant-login resolution. Tests provide controlled stores and principals, invoke the public operation, and assert its result plus durable effects.
- Real-MySQL integration is a deliberate secondary seam used only for behavior that an in-memory or mocked store cannot prove: generated unique constraints, foreign keys, transaction rollback, row locking, conditional updates, concurrent requests, and migration correctness.
- Browser end-to-end tests are a narrow tertiary seam for cross-page authentication journeys that service tests cannot prove: registration, redirect, session replacement, portal rendering, Provider decision, login again, and Tenant entry.
- Existing command/store tests for SIMAS applications, Provider applications, Provider Tenant provisioning, proxy routing, temporary credential activation, and Tenant onboarding are prior art. Existing behavior that remains valid should be retained while assertions tied to anonymous submission or approval-created credentials are replaced.
- Unit/service tests cover NPSN normalization, domain suggestion and validation, snapshot validation, identity resolution for every valid and invalid path, all five portal states, attempt ordering, and available actions per state.
- Routing tests cover central destinations for Provider Admin, every Pemohon state, promoted School Admin, Tenant members, required password change, missing Tenant, zero identity paths, and multiple identity paths.
- Security tests use a corpus of valid and invalid intent and continuation values, including absolute URLs, protocol-relative URLs, encoded bypasses, prefix-boundary tricks, other Tenant paths, Provider paths, and applicant paths.
- Submission tests cover first attempt, successful resubmission after rejection, rejection of pending/approved/non-Pemohon submission, same-key same-payload retry, same-key changed-payload conflict, different-key double submit, and privacy-safe NPSN conflict.
- Decision tests cover mandatory rejection reason, legal transitions, identical retries, conflicting final decisions, unique-domain conflict, existing-NPSN Tenant conflict, and absence of temporary credential output on approval.
- Activation tests cover migration-compatible behavior for Provider-created School Admin, first-authentication recording, mandatory password change, reset cutoff, retained history, and promoted School Admin bypass.
- MySQL integration tests prove uniqueness of binding user and canonical NPSN, `(binding, attempt)` uniqueness, owner idempotency uniqueness, and generated pending uniqueness.
- Concurrent database tests cover one account submitting different NPSNs, multiple accounts submitting one NPSN, same and different idempotency keys, concurrent resubmission, submit versus rejection, submit versus approval, and approval versus approval.
- Concurrency tests assert durable outcomes rather than timing: exactly one legal winner, no partial records, no duplicate Tenant, no overwritten final decision, and no unexpected deadlock under the controlled scenario.
- Approval integration tests assert that the user ID, credential account, and password remain unchanged; School Admin membership is assigned; active Pemohon marker is removed; binding and history remain; sessions are deleted; exactly one Tenant exists; and no temporary activation exists.
- Failure-injection integration tests fail each approval stage and assert that Tenant creation, promotion, decision, session deletion, and outbox creation all roll back together.
- Migration tests run against realistic legacy fixtures. They verify ownerless-data blocking, explicit ownership mapping, NPSN collision reporting, activation row/timestamp preservation, relation backfills, check constraints, expand-to-contract compatibility, and the staging rollback procedure.
- Route/action integration tests prove that every query and mutation performs server authorization independently of button visibility and rejects client attempts to supply role, owner, status, attempt number, or another Tenant.
- Browser scenarios cover: register→empty→submit→pending; reject→reason/history→new attempt; approve→old session revoked→login→approved portal→Tenant; Provider-created temporary credential→password change→Tenant; role-specific central login; own/cross-domain Tenant login; and open-redirect attempts.
- Release validation requires the full automated test suite, type checking, linting, and production build to pass. Pre/post-migration audits must report zero invariant violations, preserve activation row counts, and prove one-to-one approved-application/Tenant links.

## Out of Scope

- Email verification for Pemohon.
- Public registration for teachers, staff, students, guests, or any Tenant user other than Pemohon.
- Automated resolution of applicant ownership disputes or transfer of a school/NPSN between Pemohon accounts.
- A self-service UI for changing the Pemohon who represents a school.
- Editing, cancelling, or reopening a submitted Pengajuan.
- Draft persistence for an unsubmitted application form.
- Rate limiting, abuse scoring, waiting periods, or attempt limits for resubmission. These may be added later as technical controls without changing the business state machine.
- Reversing approval, deleting an approved Tenant, moving School Admin ownership, or correcting final decisions through the approval operation. Such changes require separate administrative workflows and audit decisions.
- Email or messaging delivery as part of transactional approval success.
- Changing the Tenant onboarding or Trial Tenant start rules.
- Replacing normal password recovery.
- Building the feature within this specification-writing session.

## Further Notes

- Domain language is intentional: Provider operates SIMAS; Provider Admin manages the service; Pemohon owns the pre-approval journey; Pengajuan SIMAS is the immutable request; Tenant is the isolated school workspace; School Admin is the promoted or administratively created Tenant administrator; Kredensial sementara applies only to Provider-created accounts.
- The approved application's contact details remain historical snapshot data. They must not be reused as identity or authorization signals.
- The highest-value implementation seam is the unified server-side application contract. Keeping identity resolution, portal state, decision commands, and login routing behind explicit interfaces reduces duplicated authorization logic while still allowing MySQL-specific correctness to be tested at the database boundary.
- The current anonymous submission and approval-created School Admin flow are transitional behavior to replace, not compatibility requirements to preserve.
- The Wayfinder map and its resolved decision tickets remain the rationale source. This specification is the build-facing synthesis and should be split into blocker-aware tracer-bullet tickets before implementation begins.
