### Project Structure

- Project live at `./monorepo` folder,  see `monorepo/AGENTS.md`
- read at `./monorepo/package.json` about framework, test, engine

#### Security & Tenant Isolation

- use skill `code-security` when need to trace security issue.

#### Code Style

- Next.js 16 / React 19 conventions (Server/Client Components, async APIs,
caching, Tailwind v4). See `monorepo/AGENTS.md`


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
