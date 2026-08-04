import { expect, test, type Page } from "@playwright/test";

import { e2e } from "./fixtures";

async function login(page: Page, email: string) {
  await page.goto(`/${e2e.alpha.domain}/login`);
  await expect(page.getByRole("heading", { name: `Masuk ke ${e2e.alpha.name}` })).toBeVisible({ timeout: 30_000 });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Kata Sandi").fill(e2e.password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL(new RegExp(`^https?://${e2e.alpha.domain}\\.localhost(?::\\d+)?/dashboard(?:[/?#]|$)`), { timeout: 30_000 });
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
