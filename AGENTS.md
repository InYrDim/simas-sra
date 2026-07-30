<!-- BEGIN:nextjs-agent-rules -->
READ AT monorepo/AGENTS.md
<!-- END:nextjs-agent-rules -->

## UI/UX Guidelines

### Loading States
When creating a UI component that is waiting for or creating a process in the backend, always make sure to add a loader (loading indicator). This includes:
- Form submissions
- Data fetching
- File uploads
- Any async operation that takes noticeable time

The loader should provide clear visual feedback to the user that the system is processing their request.

## Agent skills

### Custom skills

- **new-feature** — Start a new feature with its own worktree and branch from staging, then plan it with wayfinder. See `.agents/skills/new-feature/SKILL.md`.
- **tenant-feature-gating** — Assess and implement Provider-controlled feature gates for Tenant-facing features. See `.agents/skills/tenant-feature-gating/SKILL.md`.

### Tenant feature assessment

When implementing a new Tenant-facing feature, always invoke `tenant-feature-gating`. If the request does not already state whether Provider should control the feature per Tenant, ask the user before implementation. Do not add feature keys when the user decides the feature is universal.

### Issue tracker

Local markdown — issues live as files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Defaults (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context repository layout. See `docs/agents/domain.md`.

### Known Issues

When fixing a bug, check at `.known-issue` folder.
