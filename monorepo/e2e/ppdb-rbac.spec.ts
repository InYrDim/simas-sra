import { expect, test, type Page } from "@playwright/test";

import { e2e } from "./fixtures";

async function signIn(page: Page) {
  await page.goto(`http://${e2e.alpha.domain}.localhost:3100/login`);
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
  const exportUrl = `http://${e2e.alpha.domain}.localhost:3100/ppdb/submissions/export?sessionId=${e2e.alpha.ppdbSessionId}`;
  const response = await page.evaluate(async (url) => {
    const result = await fetch(url, { credentials: "include", cache: "no-store" });
    return {
      status: result.status,
      contentDisposition: result.headers.get("content-disposition"),
    };
  }, exportUrl);

  expect(response.status).toBe(200);
  expect(response.contentDisposition).toContain("ppdb-submissions.csv");
});
