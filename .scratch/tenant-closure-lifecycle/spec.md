# Lifecycle Penutupan dan Penghapusan Tenant

Status: ready-for-agent

## Problem Statement

School Admin dan Provider Admin belum memiliki lifecycle yang aman, dapat dipulihkan, dan dapat diaudit untuk menghentikan penggunaan Tenant lalu menghapusnya secara permanen. Tanpa lifecycle khusus, penghentian layanan berisiko mencampur status operasional dengan proses persetujuan, memutus akses secara tidak konsisten, menghapus data sebelum sekolah sempat mengekspor, menghasilkan penghapusan parsial, mempertahankan data sekolah tanpa alasan, atau menghidupkan kembali data yang telah dihapus ketika backup dipulihkan.

Sekolah membutuhkan proses yang transparan sejak pengajuan Penutupan Tenant, review Provider, masa tunggu, ekspor data, dan Pembukaan Kembali sampai Penghapusan Tenant. Provider membutuhkan kontrol yang aman atas keputusan, tenggat, billing, akses, audit, eksekusi lintas penyimpanan, dukungan pascapenghapusan, dan migrasi Tenant lama.

## Solution

SIMAS menyediakan lifecycle terpandu yang memisahkan status operasional Tenant dari Kasus Penutupan Tenant. Penutupan menghentikan seluruh operasi Tenant tetapi mempertahankan data dan dapat dipulihkan. Penghapusan hanya dapat dikonfirmasi Provider Admin setelah masa tunggu berakhir dan seluruh blocker bersih, lalu dilaksanakan sebagai proses bertahap, durable, idempotent, dan terverifikasi di seluruh lokasi data wajib.

School Admin mengajukan Penutupan Tenant, membatalkan pengajuan yang belum disetujui, meminta Pembukaan Kembali, memantau status, dan meminta Paket Ekspor Tenant. Provider Admin meninjau pengajuan, dapat menutup Tenant secara langsung, mengatur tenggat, memutuskan Pembukaan Kembali, menangani ekspor, dan mengonfirmasi atau melanjutkan Penghapusan Tenant. Selama Tenant ditutup, hanya Halaman Status Tenant dan kapabilitas lifecycle terbatas yang tersedia.

Penghapusan tidak otomatis terjadi ketika tenggat berakhir. Provider Admin harus melakukan autentikasi ulang, mengonfirmasi identitas Tenant, dan melewati pemeriksaan blocker atomik. Penghapusan dianggap selesai hanya setelah semua penyimpanan aktif wajib terverifikasi bersih. Bukti minimal, audit yang telah diminimalkan, dan Daftar Penekanan Penghapusan dipertahankan sesuai retensi tanpa menyimpan data operasional sekolah.

## User Stories

1. As a School Admin, I want to request Tenant Closure, so that the Provider can review my school’s decision to stop using SIMAS.
2. As a School Admin, I want the Tenant to remain active while closure is under review, so that a pending request does not interrupt school operations.
3. As a School Admin, I want to see that closure approval also schedules Tenant Deletion, so that I understand the full consequence before submitting.
4. As a School Admin, I want to provide a reason and reauthenticate before requesting closure, so that destructive requests are intentional and attributable.
5. As a School Admin, I want to see who submitted the active closure request and when, so that all School Admins share the same case context.
6. As a School Admin, I want to cancel a pending closure request, including one submitted by another School Admin, so that an erroneous request can be stopped before closure.
7. As a School Admin cancelling another administrator’s request, I want to provide a reason, so that the intervention is auditable.
8. As a School Admin, I want a stale closure request to expire after 14 days, so that an old request cannot be unexpectedly approved much later.
9. As a School Admin, I want all repeated submissions to resolve to the same active case, so that duplicate workflows are not created.
10. As a School Admin, I want to sign in after the Tenant is closed, so that I can access the limited Tenant Status Page.
11. As a School Admin, I want to see the Tenant operational status separately from the case status, so that I can distinguish service availability from workflow progress.
12. As a School Admin, I want to see the closure reason that may be disclosed, closure time, absolute deletion deadline, Tenant time zone, export status, blockers, and lifecycle history, so that I understand the current state.
13. As a School Admin, I want the absolute timestamp to be authoritative and the countdown to be secondary, so that clock or display differences do not create ambiguity.
14. As a School Admin, I want ordinary dashboards, data, configuration, APIs, and the public site to be unavailable while the Tenant is closed, so that closure is enforced consistently.
15. As a School Admin, I want to request Tenant Reopening with a reason and reauthentication, so that the Provider can consider restoring service.
16. As a School Admin, I want a reopening request to block deletion without moving the deadline, so that my request is reviewed without creating an indefinite extension.
17. As a School Admin, I want the Tenant to remain closed until the Provider approves reopening and a new subscription is successfully activated, so that service and billing state remain consistent.
18. As a School Admin, I want to request a Tenant Export Package before deletion begins, so that the school can retain its portable data.
19. As a School Admin requesting an export, I want to reauthenticate, so that access to sensitive school data is protected.
20. As an export requester, I want to see export progress and download the verified result, so that I know when the complete package is ready.
21. As an export requester, I want a single-use download link tied to my identity and valid for 15 minutes, so that the package cannot be casually shared.
22. As an export requester, I want an available package to remain downloadable for seven days, so that I have a bounded retrieval window.
23. As a School Admin, I want to request a replacement export after expiry when deletion has not started, so that an expired link does not forfeit data portability.
24. As a School Admin, I want failed exports to be retried or resolved before deletion can be confirmed, so that deletion cannot race an incomplete export.
25. As a School Admin, I want reopening to remove export artifacts, so that stale snapshots are not retained after service resumes.
26. As a School Admin, I want a guided journey with one active stage and one primary action, so that lifecycle decisions are understandable.
27. As a School Admin, I want destructive consequences explained in text rather than color alone, so that the interface remains clear and accessible.
28. As a School Admin, I want stale actions to fail with a specific explanation and refreshed state, so that I do not act on outdated information.
29. As a school representative, I want a Tenant Deletion Receipt, so that I can refer to completed deletion without possessing operational data.
30. As a school representative who lost the receipt, I want Provider support to verify my authority independently, so that possession of a reference is not treated as authentication.
31. As a non-admin Tenant user, I want a neutral closed-Tenant message, so that I do not receive lifecycle details I am not authorized to see.
32. As a user with an independent SIMAS identity, I want that identity preserved when one Tenant is deleted, so that unrelated relationships are not destroyed.
33. As a Provider Admin, I want to approve or reject a closure request, so that the Provider controls Tenant lifecycle decisions.
34. As a Provider Admin, I want to choose a waiting period from 1 to 365 calendar days when approving closure, so that the deadline reflects the Tenant’s circumstances.
35. As a Provider Admin, I want the default waiting period to be 30 days, so that ordinary cases have a safe baseline.
36. As a Provider Admin, I want to start Tenant Closure directly with a reason and reauthentication, so that operational, security, or contractual cases do not require School Admin initiation.
37. As a Provider Admin, I want to reject closure or reopening with a reason, so that School Admins receive an auditable decision.
38. As a Provider Admin, I want to approve closure or reopening with an optional note, so that routine approvals do not require redundant prose.
39. As a Provider Admin, I want to set a persistent waiting-period override per Tenant, so that future cases use the Tenant-specific default.
40. As a Provider Admin, I want an approved case to snapshot closure time, waiting days, Tenant time zone, absolute deadline, and deciding actor, so that later configuration changes cannot silently alter it.
41. As a Provider Admin, I want to extend or shorten a running deadline with a reason, so that exceptional circumstances can be handled explicitly.
42. As a Provider Admin shortening a deadline, I want to reauthenticate, so that acceleration of deletion receives stronger protection.
43. As a Provider Admin, I want to move a deadline to the current time but never into the past, so that immediate readiness is explicit and valid.
44. As a Provider Admin, I want the deadline to make a case ready for deletion without starting deletion, so that final confirmation remains deliberate.
45. As a Provider Admin, I want to approve reopening and activate a new subscription before service returns, so that reopened access has a valid billing basis.
46. As a Provider Admin, I want a failed subscription activation to leave the Tenant closed in a reopening-activation-pending state, so that the case does not finish inconsistently.
47. As a Provider Admin, I want to initiate reopening myself before deletion starts, so that the Provider can correct or reverse closure.
48. As a Provider Admin, I want to request an export for support with a reason, so that portability can be assisted without impersonating a School Admin.
49. As a Provider Admin, I want to monitor, retry, repair, or cancel export processing, so that operational failures can be resolved.
50. As a Provider Admin, I want to reassign an export to another active School Admin when the requester loses authority, so that access remains controlled.
51. As a Provider Admin, I want a checklist of current deletion prerequisites and blockers, so that final confirmation is evidence-based.
52. As a Provider Admin, I want to reauthenticate and explicitly confirm the Tenant identity before deletion, so that the irreversible action targets the intended Tenant.
53. As a Provider Admin, I want deletion confirmation to explain active-storage permanence and residual backup retention accurately, so that the system does not make a false absolute claim.
54. As a Provider Admin, I want subscription inactivity and the absence of in-progress invoice generation checked before deletion, so that billing cannot recreate Tenant-bound data.
55. As a Provider Admin, I want outstanding debt not to block closure or deletion, so that school data is not held as collateral.
56. As a Provider Admin, I want an active reopening review, export blocker, legal hold, or deletion execution to prevent final confirmation, so that incompatible workflows cannot overlap.
57. As a Provider Admin, I want a failed deletion to expose Continue Deletion rather than a second confirmation flow, so that retry resumes the same execution.
58. As a Provider Admin continuing deletion, I want to reauthenticate and give a reason, so that exceptional recovery is attributable.
59. As a Provider Admin, I want no mandatory second Provider approver, so that lifecycle cases do not deadlock in small teams.
60. As a Provider Admin, I want all authorization evaluated from current roles, account status, and sessions, so that stale privileges are not honored.
61. As a Provider Admin, I want lifecycle history available before deletion, so that decisions and blockers can be investigated.
62. As a Provider Admin, I want lifecycle audit to remain append-only and atomic with domain changes, so that state cannot change without evidence.
63. As an operations engineer, I want deletion to use durable checkpoints per storage location, so that partial work can safely continue after failure.
64. As an operations engineer, I want every deletion step to be idempotent and fenced, so that retries and stale workers cannot recreate or corrupt state.
65. As an operations engineer, I want leases and execution versions, so that only the current worker may advance a deletion execution.
66. As an operations engineer, I want uncertain external results to be verified or repeated safely, so that unknown outcomes are never treated as success.
67. As an operations engineer, I want a location to become verified clean only through its verifier, so that manual overrides cannot create false completion.
68. As an operations engineer, I want successful checkpoints skipped on retry unless re-verification is required, so that recovery is efficient and safe.
69. As an operations engineer, I want deletion failure to retain the fence and closed state without expiry, so that partially deleted data cannot be reopened.
70. As an operations engineer, I want finalization to require all mandatory locations to be verified clean, so that deletion success is truthful.
71. As an operations engineer, I want concurrent finalization to produce exactly one Deletion Record, so that completion is singular and auditable.
72. As an operations engineer, I want restored environments suppressed before receiving traffic, so that deleted Tenant data cannot reappear after disaster recovery.
73. As an operations engineer, I want the Deletion Suppression List outside ordinary backup cycles, so that restore processing always knows what must be removed again.
74. As an operations engineer, I want backup age to remain based on original creation time through copy or media migration, so that retention cannot be reset accidentally.
75. As an operations engineer, I want backup retention limited to 90 days unless a legal hold applies, so that residual data has a bounded lifetime.
76. As a support operator, I want access to minimal deletion evidence only for a referenced support, dispute, audit, or legal case, so that post-deletion access is purpose-bound.
77. As a support operator, I want to confirm timing, policy version, verifier summary, and backup permanence status, so that I can answer legitimate questions without recovering school data.
78. As a support operator, I want to reissue a receipt from minimal evidence, so that schools can regain proof without restoring a Tenant.
79. As a support operator, I want discovered residual data to trigger deletion remediation rather than disclosure or recovery, so that support cannot bypass deletion.
80. As a Provider finance operator, I want new charges to stop at effective closure time, so that closed service is not billed.
81. As a Provider finance operator, I want the current period prorated and residual payment represented as credit, so that closure is settled consistently.
82. As a Provider finance operator, I want old debt, credit, and refund handling to continue independently of the Tenant, so that financial obligations do not require retaining school data.
83. As a Provider finance operator, I want reopening to create a new subscription at current terms without retroactive charges, so that the closed period remains unbilled.
84. As a migration operator, I want existing Tenant lifecycle schema introduced additively, so that current service remains compatible during rollout.
85. As a migration operator, I want usable existing Tenants backfilled as active, so that migration does not unexpectedly close service.
86. As a migration operator, I want ambiguous legacy conditions marked for reconciliation while remaining operational, so that uncertain data cannot enable destructive lifecycle actions.
87. As a migration operator, I want migration to create neither synthetic closure cases nor deletion schedules, so that backfill cannot cause deletion.
88. As a migration operator, I want backfill to be batched, idempotent, resumable, and shadow-verified, so that rollout can be observed safely.
89. As a migration operator, I want feature-flagged activation and forward-only correction, so that rollback does not reopen a closed Tenant or reverse deletion work.
90. As a migration operator, I want legacy writers retired only after verification and observation windows, so that cutover is controlled.

## Implementation Decisions

1. Separate Tenant operational state from workflow state. A Tenant row stores only `active` or `closed`; `deleted` is never a Tenant-row status.
2. Model one durable Kasus Penutupan Tenant per lifecycle journey. At most one case may be active for a Tenant.
3. Active case states are `pending_closure_review`, `closed_waiting_deletion`, `pending_reopening_review`, `reopening_activation_pending`, `ready_for_deletion`, `deletion_in_progress`, and `deletion_failed`.
4. Final immutable case states are `rejected`, `cancelled`, `expired`, `reopened`, and `deleted`.
5. A new case may be created after `rejected`, `cancelled`, `expired`, or `reopened`. No case can be created after `deleted` because the Tenant no longer exists.
6. School Admin requests begin in `pending_closure_review`; Provider-initiated closure starts directly in `closed_waiting_deletion` and changes the Tenant to `closed` atomically.
7. Closure requests expire after 14 days without a Provider decision. Expiry leaves the Tenant active.
8. Repeated or concurrent requests are idempotent and resolve to the single active case. Final states cannot be reopened or mutated.
9. Reopening review blocks deletion but does not pause or move the deletion deadline. A rejected review returns to waiting or ready according to the unchanged deadline.
10. Reopening approval cancels the deletion schedule and enters `reopening_activation_pending`. The case becomes `reopened` and Tenant becomes `active` only after a new subscription activates successfully. Failure leaves the Tenant closed without silently restoring the old deletion schedule; Provider must retry activation or explicitly start a new closure decision.
11. Every authorization decision uses current role, account status, Tenant relationship, and session state. Historical actor snapshots remain in audit.
12. All active School Admins share authority to submit or cancel a pending closure and request reopening. No voting or primary School Admin is introduced.
13. Provider Admin controls decisions, direct closure, deadlines, reopening, export operations, deletion confirmation, and deletion continuation. Two-person approval is not required.
14. Reauthentication is required for closure request, reopening request, direct Provider closure, deadline shortening, export request and download, final deletion confirmation, and Provider deletion continuation.
15. Reasons are required for closure requests, cancellation by another School Admin, reopening requests, Provider rejection, direct closure, reopening rejection, deadline changes, support-initiated export, and deletion continuation.
16. Use a persistent Tenant waiting-period override between 1 and 365 calendar days, defaulting to 30.
17. Effective closure snapshots closure timestamp, waiting days, Tenant time zone, absolute deadline, and deciding actor. Later default or time-zone changes do not alter the case.
18. Compute the deadline at the same local wall-clock time after the selected number of calendar days, then persist the absolute timestamp as the source of truth.
19. Provider may move a deadline to the current time but never into the past. Deadline changes are forbidden after deletion begins.
20. Reaching the deadline makes the case ready; it never starts deletion automatically. A late scheduler does not move the persisted deadline.
21. There is no ordinary manual deletion hold. Deadline extension is the normal delay mechanism. A legal hold is an external compliance blocker and may block final confirmation or backup destruction only to the extent legally required.
22. Enforce closed-Tenant access through one centralized, capability-based policy that evaluates current Tenant state on every request, denies by default, and fails closed when state cannot be read.
23. Closed Tenant policy blocks normal UI, read/write APIs, API keys, service accounts, public sites, impersonation, integrations, webhooks, real-time connections, and operational jobs.
24. Closed Tenant policy permits only the Tenant Status Page, lifecycle endpoints, Provider lifecycle console, narrowly scoped support access, audit/diagnosis, and lifecycle/security/integrity workers.
25. Jobs already running must recheck Tenant state before important side effects. Cache and CDN invalidation must complete before closed or reopened visibility is considered effective.
26. Reopening does not restore revoked or expired credentials and does not replay missed jobs or webhooks automatically.
27. Use a guided journey UI with one active stage, one primary action, explicit consequences, absolute time as truth, and separate presentation of Tenant state, case state, deadline, export, and blockers.
28. Use a dedicated final-deletion screen. Destructive meaning must not rely on color. Stale mutations return a specific domain conflict and refreshed state.
29. A normal School Admin export request requires no discretionary Provider approval and enters processing directly after authorization and reauthentication. Provider may operate, repair, retry, or cancel it for security or operational reasons.
30. Only the School Admin requester and authorized Provider Admins may download an export. Provider may reassign the requester to another active School Admin with an audited action.
31. Allow one active export per case. Snapshot export scope at request acceptance.
32. Produce a versioned compressed Tenant Export Package containing UTF-8 CSV, structured JSON, original uploaded files, a manifest, checksums, and an Indonesian README.
33. Include school operational data, files, configuration, Tenant-bound users/roles, and suitable school-visible history. Exclude password hashes, tokens, sessions, secrets, Provider-internal data, other Tenant data, independent identity relationships, and internal security diagnostics.
34. Mark a package available only after complete scope and checksum verification. Partial packages are never downloadable.
35. Keep a package for seven days. Use a single-use, user-bound, 15-minute link. Encrypt packages at rest and in transit.
36. Delete export artifacts on expiry, reopening, or deletion confirmation. The package is portable but carries no promise of re-import.
37. Automatically retry transient export failures up to three times. Active or unresolved failed exports block deletion; available, expired, cancelled, or explicitly resolved permanent failures do not.
38. At final confirmation, atomically stop new export acceptance and re-evaluate all blockers. Failure leaves Tenant data intact and permits acceptance to resume; success closes export acceptance permanently.
39. Final deletion confirmation requires a ready case, closed Tenant, no reopening review, no export blocker, no other deletion execution, inactive subscription, no in-progress invoice generation, current Provider authority, successful reauthentication, and explicit Tenant identity confirmation.
40. Legal debt never blocks closure or deletion. Financial records with independent retention survive outside the Tenant boundary.
41. Use a deletion fence before cleanup begins. All request paths, workers, queues, imports, exports, webhooks, integrations, and identifier allocation must honor it.
42. Model Eksekusi Penghapusan Tenant separately with one active execution per case, bounded leases, versioning, durable attempts, and per-location checkpoints.
43. Checkpoint states are `pending`, `in_progress`, `verification_pending`, `verified_clean`, and `failed`.
44. Treat cross-storage deletion as business atomicity with forward recovery, not one distributed ACID transaction. Never roll partially deleted school data back.
45. Each storage adapter must be idempotent and have an independent verifier. Unknown outcomes are verified or repeated safely and never assumed successful.
46. Automatic retry uses exponential backoff. Provider continuation resumes the same execution and skips already verified locations unless re-verification is required.
47. `deletion_failed` never expires, cannot be cancelled, does not restore removed data, and keeps the Tenant fenced and inaccessible.
48. Finalization requires all mandatory locations verified clean, no running step, and an active fence. It atomically marks execution succeeded, marks case deleted, and emits exactly one Catatan Penghapusan Tenant.
49. Delete the Tenant row, operational data, configuration, files and derivatives, search indexes, attributable analytics, caches, temporary data, exports, queues, Tenant access relations, Tenant-only identity credentials, operational audit, and Tenant-producing application payload where no independent basis exists.
50. Preserve only genuinely independent identities, legally retained financial records, minimized lifecycle evidence, pseudonymous case shell, Catatan Penghapusan Tenant, non-reidentifying aggregates, deletion fence, and Daftar Penekanan Penghapusan.
51. Determine identity independence from explicit domain relationships, never email or phone equality. No dangling foreign keys, orphan accounts, reconstruction-capable tombstones, or predictable original identifiers may remain.
52. Audit lifecycle events append-only and atomically with domain transitions. Audit successful actions, automatic transitions, blockers, failures, and sensitive denials using server UTC, actor snapshot, source, request/correlation IDs, before/after state, required reason, deadline changes, and reauthentication outcome.
53. Never audit passwords, tokens, credentials, raw confirmation secrets, or Tenant Export Package content.
54. Before deletion, maintain full authorized lifecycle history. At deletion finalization, minimize or pseudonymize Tenant identifiers, personal actor identity, and free-form reasons according to the deletion boundary; retain the minimized immutable form for five years unless legal hold applies.
55. Immutability applies during retention and prevents UI/domain mutation. System retention expiry may delete the minimized audit after five years.
56. Generate the Tenant Deletion Receipt before Tenant access relationships are removed. After deletion, School Admin status-page access ends; receipt delivery or reissue occurs through Provider support after independent authority verification rather than a persistent Tenant surface.
57. Backup copies are encrypted, isolated, and retained no longer than 90 days from original creation unless legal hold applies. Copy, rotation, or media migration never resets age.
58. Backups may be used only for service-wide disaster recovery or explicit legal obligations, never routine support, analytics, development, testing, export, or single-Tenant restore.
59. Keep the pseudonymous Deletion Suppression List outside the ordinary backup cycle. A restored environment remains isolated and receives no traffic until suppressed Tenants are removed and deletion-boundary verification passes.
60. Distinguish “Tenant Deletion complete” from “Permanent across all storage.” The first means active storage is verified clean; the second additionally requires expiration and verified destruction of all possibly containing backups and no legal hold.
61. During closure review, subscription and billing continue. New service charges stop at effective closure time and subscription becomes inactive.
62. Prorate the current period and represent residual payment as credit rather than automatic cash refund. Existing debt remains collectible but never retains Tenant data or blocks deletion.
63. Reopening creates a new subscription at current package, price, and period without retroactive charges for the closed interval.
64. Do not create subscription invoices after deletion confirmation. Credits, refunds, debt, and legally retained financial records continue outside the deleted Tenant.
65. Post-deletion support may use only Catatan Penghapusan Tenant, minimized lifecycle audit, backup-control evidence, and independently retained administrative records.
66. Every evidence access requires a support/dispute/audit/legal purpose, case reference, minimum-data access, and its own audit entry.
67. Support may explain timing, policy version, verifier summary, and backup permanence; reissue receipts; and investigate noncompliance. It may not restore a Tenant, open backup for ordinary requests, disclose discovered residual data, create a replacement Tenant as restore, or alter original evidence.
68. If residual data is discovered, trigger deletion remediation and incident handling rather than recovery or disclosure.
69. Migrate existing Tenants with `expand → backfill → verify → activate → contract`.
70. Backfill usable Tenants as active. Only trusted equivalent legacy conditions become closed. Ambiguous conditions remain active with `needs_reconciliation`, but destructive lifecycle actions remain fail-closed.
71. Migration never creates synthetic closure cases or deletion schedules. Initial waiting-period configuration is 30 days unless a trusted valid 1–365-day value exists.
72. Run backfill in small idempotent resumable batches with shadow access verification, feature flags, staged activation, and observability.
73. Rollback disables new lifecycle mutations but never reverses durable domain decisions, reopens closed Tenants, reverses backfill, or stops deletion already in progress. Corrections move forward.
74. Cutover requires valid state/configuration for all Tenants, completed batches, resolved access differences, controlled reconciliation, retired legacy writers, adapter observation, and tested backup restore suppression.
75. Keep compatibility writing for at least 14 days after cutover; make legacy fields read-only after observation and remove old structures in a separate deployment after at least another 14 days.
76. Implement one deep lifecycle application module with a single command surface conceptually equivalent to `executeTenantLifecycleAction(actor, action)`. The discriminated action set owns authorization policy, reauthentication requirements, transition legality, idempotency, blocker evaluation, audit intent, and domain result mapping.
77. Put persistence behind one transactional lifecycle store that locks Tenant and case state and atomically writes local state, audit, outbox, billing coordination state, and deletion fence where applicable.
78. Keep framework adapters thin: read transport/session input, form actor/action, call the lifecycle command, and map the result. Do not distribute lifecycle rules across Server Actions or routes.
79. Keep the centralized capability resolver as a secondary projection seam for closed-Tenant access. It consumes operational state; it does not own workflow transitions.
80. Use a transactional outbox for asynchronous invalidation and lifecycle work. Event identity must include case, transition, or attempt identity so repeated event types across multiple cases do not collide.

## Testing Decisions

1. Test externally observable domain behavior and durable invariants, not private helper calls, SQL statement order, React component internals, or framework implementation details.
2. Use the lifecycle command as the primary and highest test seam. Exercise every action through the same interface with deterministic actor, clock, ID generator, reauthentication adapter, and store.
3. Use an in-memory transactional store for the broad policy matrix: legal/illegal transitions, authorization, current-role evaluation, reauthentication, required reasons, idempotency, deadlines, reopening activation, export blockers, billing blockers, immutable final states, and retry behavior.
4. Use a smaller MySQL integration suite through the same lifecycle command to prove unique active case, unique active deletion execution, row locking, compare-and-swap behavior, atomic state/audit/outbox writes, rollback, constraints, referential cleanup, and concurrent finalization.
5. Follow the existing command/store and MySQL approval-test style used for application decisions, including injected clock/IDs, realistic fixtures, concurrent invocations, duplicate-key translation, and failure injection after transactional steps.
6. Add state-machine contract tests proving that Tenant operational state remains separate from case state, `deleted` never appears on a Tenant row, final states are immutable, and `expired` permits a later case.
7. Add boundary-time tests immediately before, exactly at, and immediately after closure-request expiry and deletion deadline, including Tenant time-zone and daylight-saving behavior where the configured zone observes it.
8. Add concurrent command tests for duplicate closure request, Provider decision races, cancellation versus approval, reopening versus final confirmation, export request versus final confirmation, deadline change versus final confirmation, and two finalizers.
9. Add capability-resolver tests covering active/closed/missing/read-failure state across School Admin, non-admin Tenant user, Provider Admin, support capability, lifecycle worker, API key, public site, webhook, and operational job.
10. Add integration tests proving active sessions and non-browser channels cannot bypass closure, cache invalidation gates public visibility, and reopening does not replay missed work.
11. Test export behavior as an observable process: snapshot immutability, one active export, all-or-nothing availability, checksum verification, requester-only download, reassignment, single-use expiry, seven-day cleanup, automatic retry, blocker classification, and atomic acceptance closure.
12. Test deletion orchestration with fake storage adapters for success, transient failure, permanent failure, timeout/unknown result, verification failure, partial cleanup, stale lease, stale execution version, reappearing data, and safe continuation.
13. Do not assert distributed rollback. Assert durable checkpointing, active fence, idempotent adapters, forward recovery, and finalization only after all mandatory verifiers report clean.
14. Add database tests proving exactly one Catatan Penghapusan Tenant, no dangling Tenant references, correct identity preservation/deletion, and no retained reconstruction-capable school payload.
15. Add audit tests proving mutation fails when atomic audit write fails, sensitive denials are recorded without secrets, automatic transition retries are idempotent, deletion minimization removes original identifiers/free text, and retention deletion is separate from ordinary mutation.
16. Add billing tests proving review continues billing, effective closure stops new charges, proration creates credit, debt does not block deletion, invoice generation blocks final confirmation only while active, reopening uses a new subscription, and no subscription invoice is created after confirmation.
17. Add backup/restore procedure tests or executable checks proving 90-day age preservation, deletion suppression before traffic, fail-closed activation when suppression/verifier fails, and distinct active-storage versus all-storage milestones.
18. Add migration tests for additive schema compatibility, idempotent/resumable batches, active default, ambiguous reconciliation, no synthetic cases/schedules, shadow access comparison, rollback behavior, old-version understanding of closed state, and cutover gates.
19. Test the guided journey at the user-visible level for stage/action visibility, explicit consequences, absolute timestamps, blocker explanations, stale-state conflicts, accessibility of destructive warnings, and role-specific available actions. Avoid snapshot-heavy tests that lock incidental markup.
20. Use the existing Tenant login/access resolver tests as prior art for pure access projection and the existing temporary credential tests as prior art for injected password verification.
21. Keep Server Action and route tests minimal and focused only on transport mapping because lifecycle correctness belongs to the command and capability resolver seams.

## Out of Scope

- Lifecycle penghapusan identitas yang independen dari Tenant.
- Penghapusan Provider Admin atau Pemohon yang memiliki hubungan SIMAS independen.
- Notifikasi proaktif melalui email, SMS/WhatsApp, push, atau notification center; perubahan ditampilkan pada Halaman Status Tenant dan riwayat lifecycle.
- Impor otomatis Paket Ekspor Tenant kembali ke SIMAS.
- Restore satu Tenant dari backup.
- Pemulihan data setelah Eksekusi Penghapusan Tenant dimulai.
- Replay otomatis job, webhook, laporan, atau notifikasi yang terlewat selama Tenant ditutup.
- Kewajiban dua Provider Admin atau separation-of-duties untuk konfirmasi penghapusan.
- Voting atau persetujuan kolektif School Admin.
- Refund tunai otomatis.
- Penghapusan catatan keuangan yang memiliki kewajiban retensi independen.
- Penggunaan backup untuk support biasa, debugging rutin, analytics, development, testing, atau ekspor.
- Role domain baru khusus petugas dukungan.
- General-purpose operational deletion hold; legal hold eksternal tetap didukung sesuai kewajiban.
- Penentuan angka retry operasional Eksekusi Penghapusan Tenant selain retry ekspor yang telah ditentukan.
- Pembuatan Tenant pengganti sebagai mekanisme restore.
- Rekonstruksi Tenant dari case shell, audit, Catatan Penghapusan Tenant, atau bukti dukungan.
- Implementasi notifikasi proaktif yang sebelumnya dibayangkan dalam perjalanan UI.

## Further Notes

- Gunakan istilah canonical: Penutupan Tenant, Penghapusan Tenant, Kasus Penutupan Tenant, Masa Tunggu Penghapusan, Paket Ekspor Tenant, Eksekusi Penghapusan Tenant, Catatan Penghapusan Tenant, Tanda Terima Penghapusan Tenant, Daftar Penekanan Penghapusan, Penghapusan Tenant selesai, Permanen di seluruh penyimpanan, dan Halaman Status Tenant.
- Hindari istilah “Penutupan Akun”; lifecycle ini berlaku pada ruang kerja sekolah, bukan hanya satu identitas pengguna.
- Prototype perjalanan terpandu adalah referensi perilaku dan struktur informasi, bukan kode produksi.
- Jika UI menyebut penghapusan “permanen”, jelaskan bahwa penghapusan permanen berlaku pada sistem aktif dan tidak dapat dipulihkan melalui operasi normal; salinan residual dapat bertahan sementara dalam backup terisolasi hingga 90 hari atau lebih lama bila legal hold berlaku.
- Spec ini menyelesaikan konflik keputusan dengan menetapkan: ekspor School Admin tidak membutuhkan approval discretionary; download bersifat requester-only dengan reassignment terkontrol; Pembukaan Kembali menunggu aktivasi subscription baru; status `expired` mengizinkan kasus baru; notifikasi tenggat berarti pembaruan status/riwayat, bukan pesan proaktif; audit diminimalkan saat penghapusan; receipt disalurkan melalui dukungan setelah akses Tenant berakhir; dan legal hold dibedakan dari hold operasional normal.
