import { expect, test, type Page } from "@playwright/test";

import { e2e } from "./fixtures";

async function login(page: Page) {
  const loginUrl = new URL(test.info().project.use.baseURL as string);
  loginUrl.hostname = `${e2e.alpha.domain}.localhost`;
  loginUrl.pathname = "/login";
  await page.goto(loginUrl.toString());
  await page.getByLabel("Email").fill(e2e.alpha.adminEmail);
  await page.getByLabel("Kata Sandi").fill(e2e.password);
  await page.waitForFunction(() => {
    const form = document.querySelector("form");
    return form && Object.keys(form).some((key) => key.startsWith("__reactProps"));
  });
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
}

test("expanded sidebar does not overflow the PPDB page horizontally", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await login(page);
  await page.goto(`${new URL(page.url()).origin}/ppdb`);
  await expect(page.getByRole("heading", { level: 1, name: "Review Pendaftaran PPDB" })).toBeVisible();

  const sidebar = page.locator('[data-slot="sidebar"][data-state]');
  if ((await sidebar.getAttribute("data-state")) === "collapsed") {
    await page.getByRole("button", { name: "Toggle Sidebar" }).first().click();
  }
  await expect(sidebar).toHaveAttribute("data-state", "expanded");

  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(1280);
});
