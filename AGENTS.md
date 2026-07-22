<!-- BEGIN:nextjs-agent-rules -->
READ AT monorepo/AGENTS.md
<!-- END:nextjs-agent-rules -->

## Agent skills

### Custom skills

- **new-feature** — Start a new feature with its own worktree and branch from staging, then plan it with wayfinder. See `.agents/skills/new-feature/SKILL.md`.

### Issue tracker

Local markdown — issues live as files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Defaults (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context repository layout. See `docs/agents/domain.md`.

### Known Issues

When fixing a bug, check at `.known-issue` folder.
