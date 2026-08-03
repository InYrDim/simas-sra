# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: master-data.spec.ts >> School Admin can open Mata Pelajaran workspace through the real App Router
- Location: e2e\master-data.spec.ts:36:5

# Error details

```
Error: page.waitForURL: Target page, context or browser has been closed
=========================== logs ===========================
waiting for navigation until "load"
  navigated to "http://localhost:3100/login?email=master-admin-alpha%40e2e.invalid&password=E2e-master-data-2026%21"
============================================================
```

# Test source

```ts
  1   | import { expect, test, type Page } from "@playwright/test";
  2   | 
  3   | import { e2e } from "./fixtures";
  4   | 
  5   | async function login(page: Page, domain: string, email: string) {
  6   |   await page.goto("/", { waitUntil: "networkidle" });
  7   |   await page.getByRole("link", { name: "Masuk" }).click();
  8   |   await page.getByLabel("Email").fill(email);
  9   |   await page.getByLabel("Kata Sandi").fill(e2e.password);
  10  |   await page.getByRole("button", { name: "Masuk" }).click();
> 11  |   await page.waitForURL(/\/(?:continue|dashboard|apply)(?:[/?]|$)/, { timeout: 30_000 });
      |              ^ Error: page.waitForURL: Target page, context or browser has been closed
  12  |   await page.goto("/apply", { waitUntil: "networkidle" });
  13  |   await expect(page.getByText("Akun School Admin", { exact: true })).toBeVisible({ timeout: 10_000 });
  14  |   await page.getByRole("link", { name: `Masuk ke ${e2e.alpha.name}` }).click();
  15  |   await page.waitForLoadState("domcontentloaded");
  16  |   await expect(page).toHaveURL(new RegExp(`${domain}\\.localhost:3100/(?:${domain}/)?(?:login|dashboard)(?:[/?]|$)`), { timeout: 5_000 });
  17  |   if (page.url().includes("/login")) {
  18  |     await page.getByLabel("Email").fill(email);
  19  |     await page.getByLabel("Kata Sandi").fill(e2e.password);
  20  |     await page.getByRole("button", { name: "Masuk" }).click();
  21  |     await expect(page).toHaveURL(new RegExp(`${domain}\\.localhost:3100/(?:${domain}/)?dashboard(?:[/?]|$)`), { timeout: 30_000 });
  22  |   }
  23  | }
  24  | 
  25  | test("School Admin can open the critical Master Data workspace", async ({ page }) => {
  26  |   await login(page, e2e.alpha.domain, e2e.alpha.adminEmail);
  27  | 
  28  |   const response = await page.goto(`/${e2e.alpha.domain}/master`);
  29  | 
  30  |   expect(response?.status()).toBe(200);
  31  |   await expect(page.getByRole("heading", { level: 1, name: "Master Data" })).toBeVisible();
  32  |   await expect(page.getByRole("heading", { name: "Ringkasan authoritative" })).toBeVisible();
  33  |   await expect(page.getByRole("link", { name: "Kelola Tahun Ajaran" })).toBeVisible();
  34  | });
  35  | 
  36  | test("School Admin can open Mata Pelajaran workspace through the real App Router", async ({ page }) => {
  37  |   await login(page, e2e.alpha.domain, e2e.alpha.adminEmail);
  38  | 
  39  |   const response = await page.goto(`http://localhost:3100/${e2e.alpha.domain}/master/mapel`);
  40  | 
  41  |   expect(response?.status()).toBe(200);
  42  |   await expect(page.getByRole("heading", { name: "Mata Pelajaran" })).toBeVisible();
  43  |   await expect(page.getByRole("search")).toBeVisible();
  44  | });
  45  | 
  46  | test("non-admin is denied when opening a Master Data URL directly", async ({ page }) => {
  47  |   await login(page, e2e.alpha.domain, e2e.alpha.staffEmail);
  48  | 
  49  |   const response = await page.goto(`/${e2e.alpha.domain}/master/tahun-ajaran`);
  50  | 
  51  |   expect(response?.status()).toBe(403);
  52  |   await expect(page.getByRole("heading", { name: "Tahun Ajaran" })).toHaveCount(0);
  53  | });
  54  | 
  55  | test("School Admin session cannot be replayed on another tenant host", async ({ browser }) => {
  56  |   const alpha = await browser.newContext();
  57  |   const alphaPage = await alpha.newPage();
  58  |   const alphaUrl = new URL(test.info().project.use.baseURL as string);
  59  |   alphaUrl.hostname = `${e2e.alpha.domain}.localhost`;
  60  |   alphaUrl.pathname = "/login";
  61  |   await alphaPage.goto(alphaUrl.toString());
  62  |   await alphaPage.getByLabel("Email").fill(e2e.alpha.adminEmail);
  63  |   await alphaPage.getByLabel("Kata Sandi").fill(e2e.password);
  64  |   await alphaPage.getByRole("button", { name: "Masuk" }).click();
  65  |   await expect(alphaPage).toHaveURL(/dashboard/);
  66  | 
  67  |   const beta = await browser.newContext();
  68  |   const alphaCookies = await alpha.cookies();
  69  |   await beta.addCookies(
  70  |     alphaCookies.map((cookie) => ({
  71  |       ...cookie,
  72  |       domain: `${e2e.beta.domain}.localhost`,
  73  |     })),
  74  |   );
  75  |   const betaPage = await beta.newPage();
  76  |   const betaUrl = new URL(test.info().project.use.baseURL as string);
  77  |   betaUrl.hostname = `${e2e.beta.domain}.localhost`;
  78  |   betaUrl.pathname = "/master";
  79  | 
  80  |   const response = await betaPage.goto(betaUrl.toString());
  81  | 
  82  |   expect(response?.status()).toBe(404);
  83  |   await expect(betaPage.getByText(e2e.beta.name)).toHaveCount(0);
  84  |   await alpha.close();
  85  |   await beta.close();
  86  | });
  87  | 
  88  | test("foreign tenant identifier does not select or disclose its record", async ({ page }) => {
  89  |   await login(page, e2e.alpha.domain, e2e.alpha.adminEmail);
  90  | 
  91  |   const response = await page.goto(
  92  |     `/${e2e.alpha.domain}/master/tahun-ajaran?selected=${e2e.beta.academicYearId}`,
  93  |   );
  94  | 
  95  |   expect(response?.status()).toBe(200);
  96  |   await expect(page.getByRole("heading", { name: "Tahun Ajaran" })).toBeVisible();
  97  |   await expect(page.getByText(e2e.alpha.academicYearLabel)).toBeVisible();
  98  |   await expect(page.getByText(e2e.beta.academicYearLabel)).toHaveCount(0);
  99  |   await expect(page.getByText("Lifecycle")).toHaveCount(0);
  100 | });
  101 | 
  102 | test("people import review, worker retry, and result download remain tenant-isolated", async () => {
  103 |   test.skip(
  104 |     true,
  105 |     "Requires a protected-file storage fixture plus separately supervised validation and execution workers; the Playwright webServer intentionally starts only the bounded Next.js process.",
  106 |   );
  107 | });
  108 | 
```