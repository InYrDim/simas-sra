# Tenant RBAC incident runbook

Use this runbook for any blocking `tenant-rbac-health@1` signal. This document
supports evidence capture; it does not claim that a rehearsal or incident has
occurred.

## 1. Detect and preserve

1. Record the incident ID, affected Tenant ID, signal, detection time, and all
   available correlation IDs.
2. Capture the current HTTP/worker modes, epoch, contract versions, open
   findings, and audit-integrity status from authoritative application/database
   state.
3. Do not copy credentials, session material, recovery secrets, database URLs,
   or unnecessary personal data into the incident record.
4. Stop the affected promotion. Do not edit the database, replay audit events,
   reconstruct a legacy role, or mark an unknown gate as passed.

## 2. Decide emergency narrowing

Emergency mode may deny operations or permissions but may never grant access.
Before entry, record:

- Provider reauthentication proof reference and verification time;
- reason and incident ID;
- expected and observed epoch;
- policy hash and impact-preview digest;
- emergency review/expiry time;
- actor IDs and correlation IDs.

Use only the existing audited, compare-and-swap rollout command seam. A stale
epoch is a failed command, not permission to retry with guessed state.

## 3. Verify convergence

After entry, independently read authoritative state and record that HTTP and
worker are both `rbac-emergency` under the same epoch. Run the health check. Any
mode/epoch disagreement remains blocking. Verify the relevant audit partition
before using its events as evidence.

## 4. Recover and exit

Correct the root cause through normal RBAC authority. Never roll back to singular
legacy authority after multi-role acceptance. Exit emergency mode only through
the audited CAS command with a verified SHA-256 evidence digest and review time.
Record the resulting epoch and confirm both surfaces are `rbac`.

An active incident may validly have `exit: null`; release/rehearsal completion
requires exit evidence:

```text
pnpm exec tsx scripts/validate-tenant-rbac-incident-evidence.ts path/to/evidence.json --require-exit
```

The validator exits nonzero for incomplete or synthetic records. Use
`--allow-synthetic` only to check the committed synthetic example's schema:

```text
pnpm exec tsx scripts/validate-tenant-rbac-incident-evidence.ts docs/operations/evidence/tenant-rbac-incident.synthetic.example.json --require-exit --allow-synthetic
```

## 5. Close or hand over

List remaining blockers explicitly. Store real evidence in the approved
restricted release/incident store. A validated JSON file proves only that
required fields are present and internally consistent; it does not prove that
external alerts fired, humans approved actions, or production checks occurred.
