import { expect, test, type Page } from "@playwright/test";

import { e2e } from "./fixtures";

async function signIn(page: Page) {
  await page.goto(`/${e2e.alpha.domain}/login`);
  await page.getByLabel("Email").fill(e2e.alpha.adminEmail);
  await page.getByLabel("Kata Sandi").fill(e2e.password);
  await page.waitForFunction(() => {
    const form = document.querySelector("form");
    return form && Object.keys(form).some((key) => key.startsWith("__reactProps"));
  });
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL(new RegExp(`/dashboard(?:[/?#]|$)`), { timeout: 60_000 });
}

test("Tenant admin sees and can request the protected PPDB export", async ({ page }) => {
  await signIn(page);
  const response = await page.goto(`/ppdb/submissions/export?sessionId=${e2e.alpha.ppdbSessionId}`);
  expect(response?.status()).toBe(200);
  expect(response?.headers()["content-disposition"]).toContain("ppdb-submissions.csv");
});
