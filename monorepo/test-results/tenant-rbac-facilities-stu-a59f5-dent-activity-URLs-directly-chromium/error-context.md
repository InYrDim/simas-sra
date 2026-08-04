# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tenant-rbac-facilities-student-activities.spec.ts >> non-admin cannot open facilities or student-activity URLs directly
- Location: e2e\tenant-rbac-facilities-student-activities.spec.ts:40:5

# Error details

```
Error: locator.click: Target crashed 
Call log:
  - waiting for getByRole('button', { name: 'Masuk' })
    - locator resolved to <button tabindex="0" type="submit" data-slot="button" class="group/button inline-flex shrink-0 items-center justify-center rounded-4xl border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-[3px] aria-invalid:ring-destruct…>…</button>
  - attempting click action
    - waiting for element to be visible, enabled and stable
    - element is not stable
  - retrying click action
    - waiting for element to be visible, enabled and stable

```

```
Error: browserContext.close: Target page, context or browser has been closed
```