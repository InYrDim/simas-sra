# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tenant-rbac-facilities-student-activities.spec.ts >> School Admin can open each facilities and student-activity workspace
- Location: e2e\tenant-rbac-facilities-student-activities.spec.ts:31:5

# Error details

```
Error: page.goto: net::ERR_ABORTED at http://localhost:3000/e2e-alpha/master/sarpras
Call log:
  - navigating to "http://localhost:3000/e2e-alpha/master/sarpras", waiting until "load"

```

# Test source

```ts
  1  | import { expect, test, type Page } from "@playwright/test";
  2  | 
  3  | import { e2e } from "./fixtures";
  4  | 
  5  | async function login(page: Page, email: string) {
  6  |   await page.goto("/", { waitUntil: "networkidle" });
  7  |   await page.getByRole("link", { name: "Masuk" }).click();
  8  |   await page.getByLabel("Email").fill(email);
  9  |   await page.getByLabel("Kata Sandi").fill(e2e.password);
  10 |   await page.getByRole("button", { name: "Masuk" }).click();
  11 |   await page.waitForURL(/\/(?:continue|dashboard|apply)(?:[/?]|$)/, { timeout: 30_000 });
  12 |   await page.goto("/apply", { waitUntil: "networkidle" });
  13 |   await expect(page.getByText("Akun School Admin", { exact: true })).toBeVisible({ timeout: 10_000 });
  14 |   await page.getByRole("link", { name: `Masuk ke ${e2e.alpha.name}` }).click();
  15 |   await page.waitForLoadState("domcontentloaded");
  16 |   if (page.url().includes("/login")) {
  17 |     await page.getByLabel("Email").fill(email);
  18 |     await page.getByLabel("Kata Sandi").fill(e2e.password);
  19 |     await page.getByRole("button", { name: "Masuk" }).click();
  20 |     await expect(page).toHaveURL(/dashboard(?:[/?]|$)/, { timeout: 30_000 });
  21 |   }
  22 | }
  23 | 
  24 | const resourceRoutes = [
  25 |   "master/sarpras",
  26 |   "master/sarpras/aset",
  27 |   "master/organisasi",
  28 |   "master/organisasi/ekstrakurikuler",
  29 | ] as const;
  30 | 
  31 | test("School Admin can open each facilities and student-activity workspace", async ({ page }) => {
  32 |   await login(page, e2e.alpha.adminEmail);
  33 | 
  34 |   for (const route of resourceRoutes) {
> 35 |     const response = await page.goto(`/${e2e.alpha.domain}/${route}`);
     |                                 ^ Error: page.goto: net::ERR_ABORTED at http://localhost:3000/e2e-alpha/master/sarpras
  36 |     expect(response?.status(), route).toBe(200);
  37 |   }
  38 | });
  39 | 
  40 | test("non-admin cannot open facilities or student-activity URLs directly", async ({ page }) => {
  41 |   await login(page, e2e.alpha.staffEmail);
  42 | 
  43 |   for (const route of resourceRoutes) {
  44 |     const response = await page.goto(`/${e2e.alpha.domain}/${route}`);
  45 |     expect(response?.status(), route).toBe(403);
  46 |   }
  47 | });
  48 | 
```