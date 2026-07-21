import { expect, test, type Page } from "@playwright/test";

import { e2e } from "./fixtures";

async function login(page: Page, domain: string, email: string) {
  await page.goto(`/${domain}/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Kata Sandi").fill(e2e.password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL(new RegExp(`/${domain}/`));
}

test("School Admin can open the critical Master Data workspace", async ({ page }) => {
  await login(page, e2e.alpha.domain, e2e.alpha.adminEmail);

  const response = await page.goto(`/${e2e.alpha.domain}/master`);

  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: "Master Data" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ringkasan authoritative" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Kelola Tahun Ajaran" })).toBeVisible();
});

test("non-admin is denied when opening a Master Data URL directly", async ({ page }) => {
  await login(page, e2e.alpha.domain, e2e.alpha.staffEmail);

  const response = await page.goto(`/${e2e.alpha.domain}/master/tahun-ajaran`);

  expect(response?.status()).toBe(403);
  await expect(page.getByRole("heading", { name: "Tahun Ajaran" })).toHaveCount(0);
});

test("School Admin session cannot be replayed on another tenant host", async ({ browser }) => {
  const alpha = await browser.newContext();
  const alphaPage = await alpha.newPage();
  const alphaUrl = new URL(test.info().project.use.baseURL as string);
  alphaUrl.hostname = `${e2e.alpha.domain}.localhost`;
  alphaUrl.pathname = "/login";
  await alphaPage.goto(alphaUrl.toString());
  await alphaPage.getByLabel("Email").fill(e2e.alpha.adminEmail);
  await alphaPage.getByLabel("Kata Sandi").fill(e2e.password);
  await alphaPage.getByRole("button", { name: "Masuk" }).click();
  await expect(alphaPage).toHaveURL(/dashboard/);

  const beta = await browser.newContext();
  const alphaCookies = await alpha.cookies();
  await beta.addCookies(
    alphaCookies.map((cookie) => ({
      ...cookie,
      domain: `${e2e.beta.domain}.localhost`,
    })),
  );
  const betaPage = await beta.newPage();
  const betaUrl = new URL(test.info().project.use.baseURL as string);
  betaUrl.hostname = `${e2e.beta.domain}.localhost`;
  betaUrl.pathname = "/master";

  const response = await betaPage.goto(betaUrl.toString());

  expect(response?.status()).toBe(404);
  await expect(betaPage.getByText(e2e.beta.name)).toHaveCount(0);
  await alpha.close();
  await beta.close();
});

test("foreign tenant identifier does not select or disclose its record", async ({ page }) => {
  await login(page, e2e.alpha.domain, e2e.alpha.adminEmail);

  const response = await page.goto(
    `/${e2e.alpha.domain}/master/tahun-ajaran?selected=${e2e.beta.academicYearId}`,
  );

  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Tahun Ajaran" })).toBeVisible();
  await expect(page.getByText(e2e.alpha.academicYearLabel)).toBeVisible();
  await expect(page.getByText(e2e.beta.academicYearLabel)).toHaveCount(0);
  await expect(page.getByText("Lifecycle")).toHaveCount(0);
});

test("people import review, worker retry, and result download remain tenant-isolated", async () => {
  test.skip(
    true,
    "Requires a protected-file storage fixture plus separately supervised validation and execution workers; the Playwright webServer intentionally starts only the bounded Next.js process.",
  );
});
