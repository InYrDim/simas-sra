import { expect, test, type Page } from "@playwright/test";

import { e2e } from "./fixtures";

async function login(page: Page, email: string) {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.getByRole("link", { name: "Masuk" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Kata Sandi").fill(e2e.password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL(/\/(?:continue|dashboard|apply)(?:[/?]|$)/, { timeout: 30_000 });
  await page.goto("/apply", { waitUntil: "networkidle" });
  await expect(page.getByText("Akun School Admin", { exact: true })).toBeVisible({ timeout: 10_000 });
  await page.getByRole("link", { name: `Masuk ke ${e2e.alpha.name}` }).click();
  await page.waitForLoadState("domcontentloaded");
  if (page.url().includes("/login")) {
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Kata Sandi").fill(e2e.password);
    await page.getByRole("button", { name: "Masuk" }).click();
    await expect(page).toHaveURL(/dashboard(?:[/?]|$)/, { timeout: 30_000 });
  }
}

const resourceRoutes = [
  "master/sarpras",
  "master/sarpras/aset",
  "master/organisasi",
  "master/organisasi/ekstrakurikuler",
] as const;

test("School Admin can open each facilities and student-activity workspace", async ({ page }) => {
  await login(page, e2e.alpha.adminEmail);

  for (const route of resourceRoutes) {
    const response = await page.goto(`/${e2e.alpha.domain}/${route}`);
    expect(response?.status(), route).toBe(200);
  }
});

test("non-admin cannot open facilities or student-activity URLs directly", async ({ page }) => {
  await login(page, e2e.alpha.staffEmail);

  for (const route of resourceRoutes) {
    const response = await page.goto(`/${e2e.alpha.domain}/${route}`);
    expect(response?.status(), route).toBe(403);
  }
});
