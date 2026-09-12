import { expect, test } from "@playwright/test";

import { e2e } from "./fixtures";
import {
  currentBaseURL,
  expectPageDenied,
  logout,
  SDN191_TENANT_NAME,
  sidebarMenuLabels,
  signIn,
  tenantUrl,
} from "./rbac-helpers";

// VAL-CROSS-004/007/008 — session consistency: logout/login cycles never leak
// a previous role's menu, logged-out sessions redirect to the tenant login, a
// session does not cross into another tenant host, and parallel guru/siswa
// sessions stay fully isolated.

test("logout/login cycles keep each role's menu isolated across two cycles", async ({ page }) => {
  const baseURL = currentBaseURL();

  // Cycle 1a: school-admin has the full menu.
  await signIn(page, baseURL, "school-admin");
  let labels = await sidebarMenuLabels(page);
  expect(labels).toContain("E-Library");

  // Logout -> login page; a protected page right after logout redirects to login.
  await logout(page);
  await page.goto(tenantUrl(baseURL, "/dashboard"));
  await expect(page).toHaveURL(/\/login(?:[/?#]|$)/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: `Masuk ke ${SDN191_TENANT_NAME}` })).toBeVisible();

  // Cycle 1b: guru menu (no admin-only leftovers).
  await signIn(page, baseURL, "guru");
  labels = await sidebarMenuLabels(page);
  expect(labels).toContain("Absensi");
  expect(labels).not.toContain("E-Library");

  // Cycle 1c: siswa menu (no Absensi leftovers).
  await logout(page);
  await signIn(page, baseURL, "siswa");
  labels = await sidebarMenuLabels(page);
  expect(labels).not.toContain("Absensi");
  expect(labels).not.toContain("E-Library");

  // Cycle 2: back to school-admin, full menu again.
  await logout(page);
  await signIn(page, baseURL, "school-admin");
  labels = await sidebarMenuLabels(page);
  expect(labels).toContain("E-Library");
  expect(labels).toContain("Absensi");
});

test("logged-out visitor on a protected page is redirected to the tenant login", async ({ page }) => {
  await page.goto(tenantUrl(currentBaseURL(), "/dashboard"));
  await expect(page).toHaveURL(/\/login(?:\?|$)/, { timeout: 30_000 });
  await expect(
    page.getByRole("heading", { name: `Masuk ke ${SDN191_TENANT_NAME}` }),
  ).toBeVisible();
});

test("a guru session does not cross into another tenant host", async ({ page }) => {
  const baseURL = currentBaseURL();
  await signIn(page, baseURL, "guru");

  // Open a different tenant host with the same browser context. The session
  // cookie is scoped to the SDN 191 subdomain, so the other tenant must show
  // its own login page and never the SDN 191 menu.
  await page.goto(tenantUrl(baseURL, "/dashboard", e2e.alpha.domain));
  await expect(page).toHaveURL(/\/login(?:\?|$)/, { timeout: 30_000 });
  await expect(
    page.getByRole("heading", { name: `Masuk ke ${e2e.alpha.name}` }),
  ).toBeVisible();
  const labels = await sidebarMenuLabels(page);
  expect(labels).not.toContain("Absensi");
});

test("parallel guru and siswa sessions stay isolated", async ({ browser }) => {
  const baseURL = currentBaseURL();

  const guruContext = await browser.newContext();
  const guruPage = await guruContext.newPage();
  await signIn(guruPage, baseURL, "guru");

  const siswaContext = await browser.newContext();
  const siswaPage = await siswaContext.newPage();
  await signIn(siswaPage, baseURL, "siswa");

  // Live isolation: same tenant, different sessions.
  expect(await sidebarMenuLabels(guruPage)).toContain("Absensi");
  expect(await sidebarMenuLabels(siswaPage)).not.toContain("Absensi");

  // Siswa stays denied on /absensi while the guru session is alive.
  await siswaPage.goto(tenantUrl(baseURL, "/absensi"));
  await expectPageDenied(siswaPage, "Absensi");

  // Logging out the guru session does not disturb the siswa session.
  await logout(guruPage);
  await siswaPage.goto(tenantUrl(baseURL, "/dashboard"));
  await expect(
    siswaPage.getByRole("heading", { level: 2, name: "Ringkasan" }),
  ).toBeVisible({ timeout: 30_000 });
  expect(await sidebarMenuLabels(siswaPage)).not.toContain("Absensi");

  await guruContext.close();
  await siswaContext.close();
});
