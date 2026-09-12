# Tenant RBAC health signal contract

`tenant-rbac-health@1` is the stable repository contract for Issue 32 stop
conditions. It describes application/database observations only. It does not
prove that an external monitoring system delivered an alert.

Run directly because no package alias is intentionally added:

```text
pnpm exec tsx scripts/check-tenant-rbac-health.ts
```

The command prints JSON and exits nonzero when any signal has `blocking`
severity. `externalAlertDeliveryVerified` is always `false`.

| Signal | Scope | Severity | Required response |
| --- | --- | --- | --- |
| `unexplained-widening` | both | blocking | Stop promotion; investigate the contract comparison. |
| `isolation-mismatch` | both | blocking | Stop promotion and follow the incident runbook. |
| `next-request-revocation-failure` | HTTP | blocking | Stop promotion; preserve correlation and epoch evidence. |
| `worker-execution-authorization-failure` | worker | blocking | Stop worker promotion; verify execution-time re-evaluation. |
| `audit-integrity-failure` | both | blocking | Do not use the affected audit partition as evidence. |
| `unsupported-version` | both | blocking | Do not promote; deploy a supported contract bundle. |
| `school-admin-coverage-violation` | both | blocking | Stop promotion and restore valid RBAC coverage normally. |
| `emergency-review-overdue` | both | blocking | Review immediately; do not silently exit emergency mode. |
| `http-worker-epoch-mismatch` | both | blocking | Treat as failed convergence and investigate. |
| `promotion-evidence-unknown` | recorded surface | warning | Obtain real gate evidence; unknown is never converted to pass. |

Deduplication keys contain only contract version, Tenant ID, surface, and signal
code. The CLI maps existing open blocking reconciliation findings to gates and
checks persisted rollout versions. Gates not represented in repository state
remain `unknown`; the tool never fabricates successful observations.
