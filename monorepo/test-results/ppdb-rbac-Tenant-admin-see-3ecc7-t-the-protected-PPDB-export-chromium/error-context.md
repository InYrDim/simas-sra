# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ppdb-rbac.spec.ts >> Tenant admin sees and can request the protected PPDB export
- Location: e2e\ppdb-rbac.spec.ts:17:5

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 200
Received: 404
```

# Test source

```ts
  1  | import { expect, test, type Page } from "@playwright/test";
  2  | 
  3  | import { e2e } from "./fixtures";
  4  | 
  5  | async function signIn(page: Page) {
  6  |   await page.goto(`/${e2e.alpha.domain}/login`);
  7  |   await page.getByLabel("Email").fill(e2e.alpha.adminEmail);
  8  |   await page.getByLabel("Kata Sandi").fill(e2e.password);
  9  |   await page.waitForFunction(() => {
  10 |     const form = document.querySelector("form");
  11 |     return form && Object.keys(form).some((key) => key.startsWith("__reactProps"));
  12 |   });
  13 |   await page.getByRole("button", { name: "Masuk" }).click();
  14 |   await expect(page).toHaveURL(new RegExp(`/dashboard(?:[/?#]|$)`), { timeout: 60_000 });
  15 | }
  16 | 
  17 | test("Tenant admin sees and can request the protected PPDB export", async ({ page }) => {
  18 |   await signIn(page);
  19 |   const response = await page.goto(`/ppdb/submissions/export?sessionId=${e2e.alpha.ppdbSessionId}`);
> 20 |   expect(response?.status()).toBe(200);
     |                              ^ Error: expect(received).toBe(expected) // Object.is equality
  21 |   expect(response?.headers()["content-disposition"]).toContain("ppdb-submissions.csv");
  22 | });
  23 | 
```