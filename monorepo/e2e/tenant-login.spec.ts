import { expect, test } from "@playwright/test";

import { e2e } from "./fixtures";

test("School Admin can log in to the Tenant dashboard", async ({ page }) => {
  await page.goto(`/${e2e.alpha.domain}/login`);

  await expect(
    page.getByRole("heading", { name: `Masuk ke ${e2e.alpha.name}` }),
  ).toBeVisible({ timeout: 30_000 });
  await page.getByLabel("Email").fill(e2e.alpha.adminEmail);
  await page.getByLabel("Kata Sandi").fill(e2e.password);
  await page.waitForFunction(() => {
    const form = document.querySelector("form");
    return form && Object.keys(form).some((key) => key.startsWith("__reactProps"));
  });
  await page.getByRole("button", { name: "Masuk" }).click();

  await expect(page).toHaveURL(
    new RegExp(
      `^https?://${e2e.alpha.domain}\\.localhost(?::\\d+)?/dashboard(?:[/?#]|$)`,
    ),
    { timeout: 60_000 },
  );
  await expect(
    page.getByRole("heading", { level: 2, name: "Ringkasan" }),
  ).toBeVisible();
});
