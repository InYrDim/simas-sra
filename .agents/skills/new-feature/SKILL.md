---
name: new-feature
description: "Start a new feature with its own worktree and branch from staging, then plan it with wayfinder."
argument-hint: "Feature name or short description"
---

# New Feature

Bootstrap a new feature: isolated worktree, fresh branch from `staging`, and a wayfinder map to plan the work.

## Workflow

### 1. Name the feature

If the user provided an argument, use it as the feature name. Otherwise, ask.

Derive a **slug** from the name: lowercase, hyphens for spaces, no special characters. Example: `Multi-Tenant Routing` → `multi-tenant-routing`.

### 2. Create the worktree

```bash
git fetch origin staging
git worktree add ../<slug> -b feature/<slug> origin/staging
```

- The worktree lives **alongside** the main repo (sibling directory).
- The branch is always `feature/<slug>`, always rooted at `origin/staging`.
- If the worktree or branch already exists, **stop and tell the user** — don't overwrite.

### 3. Scaffold the issue tracker

Inside the new worktree, create the wayfinder directory structure:

```bash
mkdir -p .scratch/<slug>/issues
```

Create a minimal `spec.md` at `.scratch/<slug>/spec.md`:

```markdown
# <Feature Name>

Status: draft

## Overview

<one-paragraph summary derived from the feature name — refine after wayfinder planning>
```

### 4. Invoke wayfinder

Switch into the worktree directory and invoke `/wayfinder` to chart the map for this feature. Pass the feature name and spec as context:

```
/wayfinder

Feature: <Feature Name>
Worktree: ../<slug>
Branch: feature/<slug>
Spec: .scratch/<slug>/spec.md
```

Let wayfinder run its full charting flow (grilling → destination → map → tickets).

### 5. Hand off

After wayfinder finishes charting, tell the user:

- Where the worktree is: `../<slug>`
- What branch they're on: `feature/<slug>`
- The map location: `.scratch/<slug>/map.md`
- How to start working: `cd ../<slug>` then `/wayfinder` with the map, or pick a ticket from the frontier

## Rules

- **Never create a worktree on the current branch.** Always from `origin/staging`.
- **Never force-overwrite** an existing worktree or branch. Fail loudly.
- **One feature, one worktree.** If the user wants multiple features, run this skill multiple times.
- The worktree is **disposable** — it gets merged or deleted when the feature ships. Don't precious-ify it.
