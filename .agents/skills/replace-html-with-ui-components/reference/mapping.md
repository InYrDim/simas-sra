# Native HTML → `components/ui` mapping

All imports are from `@/components/ui/<file>` unless noted. `cn` merges classes, so
passing `className` on the replacement is enough — don't reproduce base styling manually.

## Form controls

| Native | Component(s) | File | Notes |
|---|---|---|---|
| `<button>` | `Button` | `button.tsx` | Map visual intent to `variant` (`default`/`outline`/`secondary`/`ghost`/`destructive`/`link`) and `size` (`default`/`xs`/`sm`/`lg`/`icon`/`icon-xs`/`icon-sm`/`icon-lg`) instead of custom classes. Preserve `type`, `onClick`, `disabled`, `form`. |
| `<a>` styled/behaving like a button | `Button` with `render` prop | `button.tsx` | `<Button render={<a href="...">}>Label</Button>`. Leave plain navigational links as `<a>`. |
| `<input type="text\|email\|password\|number\|search\|tel\|url\|date\|...">` | `Input` | `input.tsx` | Drop-in; preserve `type`, `value`/`defaultValue`, `onChange`, `name`, `placeholder`, `ref`. |
| `<textarea>` | `Textarea` | `textarea.tsx` | Same prop passthrough as `Input`. |
| `<input type="checkbox">` (selecting/marking an item, e.g. row selection, "I agree") | `Checkbox` | `checkbox.tsx` | Controlled via `checked`/`onCheckedChange` (base-ui), not `onChange`. |
| `<input type="checkbox">` used as an on/off setting toggle | `Switch` | `switch.tsx` | Same semantics as Checkbox but visually/semantically a toggle. Pick this when the label reads like a setting ("Enable notifications") rather than a selection. |
| `<input type="radio">` (+ wrapping container) | `RadioGroup` (wrapper) + `RadioGroupItem` (each option) | `radio-group.tsx` | The wrapping `<div>`/`<fieldset>` becomes `RadioGroup`; each `<input type="radio">` becomes a `RadioGroupItem` with its own `value`. |
| `<input type="range">` | `Slider` | `slider.tsx` | Supports single or range (array) `value`/`defaultValue`, `min`, `max`. |
| `<input type="file">` | Leave as native `<input type="file">` unless the surrounding UI already matches the `Attachment` pattern | `attachment.tsx` | Only swap if there's an existing attachment/upload list UI to fold into. |
| `<label>` | `Label` | `label.tsx` | Preserve `htmlFor` ↔ control `id` pairing exactly. |
| `<fieldset>` / `<legend>` | `FieldSet` / `FieldLegend` (part of the `Field` family) | `field.tsx` | Only adopt the full `Field`/`FieldContent`/`FieldLabel`/`FieldDescription`/`FieldError` pattern when restructuring a whole form field — don't half-migrate. |
| `<select>` + `<option>`/`<optgroup>`, plain/native form submission | `NativeSelect` + `NativeSelectOption` + `NativeSelectOptGroup` | `native-select.tsx` | Keeps native `<select>` semantics (native `name`, works without JS/controlled state) but styled. Use when the select is uncontrolled or posts via a native/server-action form. |
| `<select>` acting as a rich, controlled, custom-styled dropdown | `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`, `SelectGroup`, `SelectLabel`, `SelectSeparator` | `select.tsx` | Use when the code already manages selected value in React state/controlled form state and wants custom item rendering. |
| `<progress>` | `Progress` (+ `ProgressTrack`/`ProgressIndicator`, optionally `ProgressLabel`/`ProgressValue`) | `progress.tsx` | `Progress` renders its own track/indicator by default; only add the sub-parts explicitly if customizing. |
| Multiple `<input maxLength=1>` for OTP/PIN entry | `InputOtp` family | `input-otp.tsx` | |
| `<input>` with a manual icon/button/addon wrapper div | `InputGroup` family | `input-group.tsx` | |

## Structure & layout widgets

| Native | Component(s) | File | Notes |
|---|---|---|---|
| `<hr>` | `Separator` | `separator.tsx` | Set `orientation="vertical"` if used vertically (default is horizontal). |
| `<table>`/`<thead>`/`<tbody>`/`<tfoot>`/`<tr>`/`<th>`/`<td>`/`<caption>` | `Table`/`TableHeader`/`TableBody`/`TableFooter`/`TableRow`/`TableHead`/`TableCell`/`TableCaption` | `table.tsx` | Replace the *whole* table as a set — don't mix native `<tr>` with `TableRow`, etc. `Table` already wraps itself in an overflow container. |
| `<details>` / `<summary>` (single disclosure) | `Collapsible` / `CollapsibleTrigger` / `CollapsibleContent` | `collapsible.tsx` | |
| Multiple grouped `<details>` (accordion behavior) | `Accordion` family | `accordion.tsx` | Use when several disclosures share exclusive/grouped open state. |
| Hand-rolled modal (manual backdrop div + portal + focus trap) or native `<dialog>` for general modals | `Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`, `DialogClose` | `dialog.tsx` | |
| Hand-rolled or native `<dialog>` used for confirm/destructive-action prompts | `AlertDialog`, `AlertDialogTrigger`, `AlertDialogContent`, `AlertDialogHeader`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogAction`, `AlertDialogCancel` | `alert-dialog.tsx` | Use instead of `Dialog` specifically for "are you sure?" flows. |
| Manual slide-in panel (fixed-position div sliding from an edge) | `Sheet` family | `sheet.tsx` | |
| Manual bottom-sheet-style panel (mobile drawer) | `Drawer` family | `drawer.tsx` | |
| Manual positioned popup anchored to a trigger (non-modal) | `Popover` family | `popover.tsx` | |
| Manual rich hover preview (bio card, link preview on hover) | `HoverCard` family | `hover-card.tsx` | |
| Manual right-click context menu | `ContextMenu` family | `context-menu.tsx` | |
| Manual dropdown menu (`<ul>`/`<li>` + click-outside/keydown handlers) | `DropdownMenu` family | `dropdown-menu.tsx` | |
| Manual top menu bar with nested menus | `Menubar` family | `menubar.tsx` | |
| Manual top-level site nav with dropdown panels | `NavigationMenu` family | `navigation-menu.tsx` | |
| `<nav aria-label="breadcrumb">` built by hand | `Breadcrumb` family | `breadcrumb.tsx` | |
| Manual page-number `<nav>`/links | `Pagination` family | `pagination.tsx` | |
| `role="tablist"` built by hand | `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` | `tabs.tsx` | |
| Manual resizable split panes (mousedown/mousemove drag handlers) | `Resizable` family | `resizable.tsx` | |
| Manual scroll-snap carousel | `Carousel` family | `carousel.tsx` | |
| Manual overflow container with custom scrollbar styling | `ScrollArea` family | `scroll-area.tsx` | |
| Manual collapsible app sidebar/nav shell | `Sidebar` family | `sidebar.tsx` | |

## Feedback & content widgets

| Native | Component(s) | File | Notes |
|---|---|---|---|
| `title="..."` attribute used purely for a hover tooltip | `Tooltip`, `TooltipTrigger`, `TooltipContent` | `tooltip.tsx` | A single `TooltipProvider` should already wrap the app/layout — don't add a new one per instance, just check one exists. |
| `<div role="alert">` / manual callout box | `Alert`, `AlertTitle`, `AlertDescription`, `AlertAction` | `alert.tsx` | |
| Manual toast/`alert()`/`window.confirm` notification | `sonner` (`Toaster`/`toast()`) | `sonner.tsx` | |
| `<kbd>` used to show a keyboard shortcut in UI | `Kbd` / `KbdGroup` | `kbd.tsx` | Only for shortcut/key displays, not generic inline code snippets. |
| `<img>` + manual initials-fallback logic for a user avatar | `Avatar`, `AvatarImage`, `AvatarFallback` (+ `AvatarBadge`, `AvatarGroup`, `AvatarGroupCount` if applicable) | `avatar.tsx` | |
| Small pill/status `<span>`/`<div>` | `Badge` | `badge.tsx` | Map color intent to `variant`. |
| Bordered/shadowed `<div>` container used as a card | `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardAction`, `CardContent`, `CardFooter` | `card.tsx` | |
| `animate-pulse` skeleton placeholder `<div>` | `Skeleton` | `skeleton.tsx` | |
| Hand-rolled loading spinner SVG | `Spinner` | `spinner.tsx` | |
| Manual toggle button (pressed/unpressed) | `Toggle` | `toggle.tsx` | |
| Manual group of toggle buttons (single/multi-select) | `ToggleGroup` family | `toggle-group.tsx` | |
| Manual typeahead/autocomplete (`<input>` + custom `<ul>` results list) | `Combobox` family or `Command` family | `combobox.tsx` / `command.tsx` | `Combobox` for a single-field autocomplete input; `Command` for a full command-palette style list (used e.g. inside a `Dialog`/`Popover`). |
| Manual "N/N" step indicator, breadcrumb-like markers | `Marker` | `marker.tsx` | |
| `<img>`/`<div>` locked to a fixed ratio via padding-hack | `AspectRatio` | `aspect-ratio.tsx` | |

## Do NOT replace

These have no `components/ui` equivalent and should stay native — replacing them would
remove semantics or add no value:

- Plain layout/containers: `<div>`, `<span>` (unless matching a specific slot above)
- Document structure/semantics: `<header>`, `<footer>`, `<main>`, `<section>`, `<article>`,
  `<nav>` (unless it's specifically a breadcrumb or pagination nav — see above)
- Headings and text: `<h1>`–`<h6>`, `<p>`
- Plain content lists: `<ul>`/`<ol>`/`<li>` that are not tab lists, menus, or comboboxes
- Plain navigational `<a>` links that aren't styled/behaving as a button
- Anything already inside `monorepo/components/ui/**` — these files are the primitives
  themselves, never rewrite their internals as part of this skill

## Ambiguous cases — decide from actual usage, don't guess

- **Checkbox vs. Switch**: selection/marking → `Checkbox`; on/off setting → `Switch`.
- **Select vs. NativeSelect**: uncontrolled/native-form-submit and simple options →
  `NativeSelect`; controlled React state with custom item rendering → `Select`.
- **Dialog vs. AlertDialog**: general content/forms in a modal → `Dialog`; yes/no
  confirmation or destructive-action prompt → `AlertDialog`.
- **Collapsible vs. Accordion**: one independent disclosure → `Collapsible`; several
  disclosures sharing grouped/exclusive open state → `Accordion`.
- **Combobox vs. Command**: single autocomplete field → `Combobox`; full searchable
  command list/palette (often inside a `Dialog` or `Popover`) → `Command`.
