---
name: replace-html-with-ui-components
description: Find native/browser-built-in HTML elements (button, input, select, textarea, table, dialog, details, hr, progress, etc.) in this repo's React/Next.js code and swap them for the equivalent predefined component in monorepo/components/ui, without breaking props, event handlers, refs, form wiring, or accessibility. Use when the user wants to "use the design system", "replace native inputs/buttons/etc with ui components", or make a file/directory consistent with components/ui.
---

# Replacing native HTML widgets with `components/ui`

This repo has a shadcn-style design system at `monorepo/components/ui`, built on top of
`@base-ui/react` primitives. Aliases (from `monorepo/components.json`):

- `@/components/ui` → `monorepo/components/ui`
- `@/lib/utils` → `monorepo/lib/utils` (exports `cn`)

Never edit files inside `monorepo/components/ui/**` as part of this skill — those files
*are* the primitives. Only replace native elements in app/feature code that consumes them
(e.g. under `monorepo/app`, `monorepo/components` outside of `ui/`, etc.).

Read `reference/mapping.md` in this skill directory before starting. It has the full
native-element → component table, decision points for ambiguous cases (checkbox vs.
switch, select vs. native-select, dialog vs. alert-dialog, collapsible vs. accordion),
and the list of elements that should NOT be replaced.

## Workflow

1. **Scope the work.** If the user didn't specify a file/directory, ask which
   file(s), component(s), or directory to target. Don't sweep the whole repo unless
   explicitly asked.

2. **Inventory candidates.** Use `grep` scoped to the target path (exclude
   `components/ui/**`, `node_modules/**`, `.next/**`) to find native tags/attributes that
   have a mapping, e.g.:
   - `<button`, `<input`, `<select`, `<option`, `<textarea`, `<label`
   - `<table`, `<thead`, `<tbody`, `<tfoot`, `<tr`, `<th`, `<td`, `<caption`
   - `<hr`, `<progress`, `<details`, `<summary`, `<kbd`, `<dialog`
   - `title=` (hover tooltip attribute), `role="alert"`, `role="tablist"`,
     `aria-label="breadcrumb"`
   - hand-rolled patterns: manual backdrop/portal modals, manual dropdown lists with
     click-outside handlers, `animate-pulse` skeleton divs, spinner SVGs

3. **Read before replacing.** For every candidate, read enough surrounding code to
   capture its full behavior: `id`/`name`/`value`/`defaultValue`, `onChange`/`onClick`/
   other handlers, `ref`, `disabled`/`required`/`aria-*`, `htmlFor`↔`id` pairing with any
   sibling `<label>`, whether it's inside a `<form>` relying on native submission, and any
   conditional rendering around it.

4. **Classify each candidate** against `reference/mapping.md`:
   - If it has a clear component match and isn't in the "don't replace" list, replace it.
   - If it's an ambiguous case (see decision points in the reference), decide based on the
     actual usage (semantics of on/off vs. selection, native form submission vs. custom
     controlled state, single collapsible vs. grouped accordion, confirmation vs. general
     modal) — don't guess blindly, check how the value is consumed downstream.
   - If it's plain layout/semantic HTML with no component equivalent (`div`, `span`,
     `header`, `main`, `section`, `p`, plain `ul`/`li`, plain `a` links), leave it alone.

5. **Replace with `edit_file`,** preserving all functionality:
   - Import the component(s) from `@/components/ui/<file>`.
   - Carry over every prop/handler/ref/id/name/aria attribute onto the new component.
   - Preserve `<label htmlFor>` ↔ control `id` pairing when swapping in `Label`.
   - For multi-part native markup (table, dialog, select), use the *matching set* of
     subcomponents (e.g. `Table`+`TableHeader`+`TableBody`+`TableRow`+`TableHead`+
     `TableCell`, not just `Table`) — check `reference/mapping.md` for each family's
     required subcomponents.
   - Keep custom/layout-specific classes by passing them via `className` (these
     components merge classes with `cn`, they don't need you to reproduce the base
     styling — drop redundant manual styling that duplicated what the component already
     provides).
   - For elements styled to *look like* another component (e.g. an `<a>` styled as a
     button), use the base-ui `render` prop pattern already used in this codebase, e.g.
     `<Button render={<a href="...">...} />}` rather than nesting a real `<button>` inside
     an `<a>` or vice versa.
   - Remove now-unused manual icons/state/styling that the ui component already handles
     (e.g. a hand-rolled chevron icon when swapping to `Select`, which renders its own).

6. **Don't touch `components/ui/**` and don't introduce new one-off primitives** — if no
   good mapping exists, leave the native element as-is and note it in your summary instead
   of inventing a workaround.

7. **Verify:**
   - Run the `diagnostics` tool on each edited file.
   - Run `pnpm typecheck` and `pnpm lint` from the `monorepo` root directory.
   - Re-read the edited JSX to confirm tags are balanced and subcomponent nesting order
     matches the original component's expected structure (check the component's own file
     under `components/ui` if unsure).

8. **Summarize** what was replaced (native element → ui component, per file) and list any
   native elements you deliberately left untouched with a one-line reason (no mapping,
   ambiguous/needs a product decision, or purely semantic/layout).

For large sweeps across many files, split the file list into disjoint groups and delegate
each group to a sub-agent with this same SKILL.md content and the specific file list, so
write scopes don't overlap.
