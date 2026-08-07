import { expect, test } from "@playwright/test";

import {
  currentBaseURL,
  expectPageDenied,
  expectPageRendered,
  SDN191_TENANT_NAME,
  sdn191Credentials,
  tenantUrl,
} from "./rbac-helpers";

// VAL-CROSS-011 + VAL-DATA-011 — post-login destination semantics. A default
// login (no continuation) always lands on /dashboard; an explicit continuation
// is honored only when the target page is allowed for the role; a continuation
// to a denied page ends in a clean deny (no loop, no content leak).

test("default login without continuation lands on /dashboard", async ({ page }) => {
  const baseURL = currentBaseURL();
  await page.goto(tenantUrl(baseURL, "/login"));
  await expect(
    page.getByRole("heading", { name: `Masuk ke ${SDN191_TENANT_NAME}` }),
  ).toBeVisible({ timeout: 30_000 });
  const cred = sdn191Credentials("guru");
  await page.getByLabel("Email").fill(cred.email);
  await page.getByLabel("Kata Sandi").fill(cred.password);
  await page.waitForFunction(() => {
    const form = document.querySelector("form");
    return form !== null && Object.keys(form).some((key) => key.startsWith("__reactProps"));
  });
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL(/\/dashboard(?:[/?#]|$)/, { timeout: 60_000 });
  await expectPageRendered(page, "Ringkasan");
});

test("continuation to an allowed page is honored (guru -> /absensi)", async ({ page }) => {
  const baseURL = currentBaseURL();

  // Visit the protected page logged-out: the proxy redirects to /login with a
  // continuation pointing back to /absensi.
  await page.goto(tenantUrl(baseURL, "/absensi"));
  await expect(page).toHaveURL(/\/login(?:\?|$)/, { timeout: 30_000 });
  await expect(page).toHaveURL(/continuation=/);

  const cred = sdn191Credentials("guru");
  await page.getByLabel("Email").fill(cred.email);
  await page.getByLabel("Kata Sandi").fill(cred.password);
  await page.waitForFunction(() => {
    const form = document.querySelector("form");
    return form !== null && Object.keys(form).some((key) => key.startsWith("__reactProps"));
  });
  await page.getByRole("button", { name: "Masuk" }).click();

  // Post-login the continuation is honored: final URL is /absensi with content.
  await expect(page).toHaveURL(/\/absensi(?:[/?#]|$)/, { timeout: 60_000 });
  await expectPageRendered(page, "Absensi");
});

test("continuation to a denied page ends in a clean deny (siswa -> /absensi)", async ({ page }) => {
  const baseURL = currentBaseURL();

  await page.goto(tenantUrl(baseURL, "/absensi"));
  await expect(page).toHaveURL(/\/login(?:\?|$)/, { timeout: 30_000 });

  const cred = sdn191Credentials("siswa");
  await page.getByLabel("Email").fill(cred.email);
  await page.getByLabel("Kata Sandi").fill(cred.password);
  await page.waitForFunction(() => {
    const form = document.querySelector("form");
    return form !== null && Object.keys(form).some((key) => key.startsWith("__reactProps"));
  });
  await page.getByRole("button", { name: "Masuk" }).click();

  // No redirect loop: the final URL settles on /absensi and the forbidden
  // boundary is shown without ever rendering the Absensi content.
  await expect(page).toHaveURL(/\/absensi(?:[/?#]|$)/, { timeout: 60_000 });
  await expectPageDenied(page, "Absensi");
});
