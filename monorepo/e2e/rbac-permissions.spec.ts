import "dotenv/config";

import { expect, test } from "@playwright/test";

import {
  currentBaseURL,
  expectPageDenied,
  expectPageRendered,
  logout,
  signIn,
  tenantUrl,
} from "./rbac-helpers";

const PERMISSION_PAGE = "/settings/permissions";

test("school-admin renders the permission explorer and the registry list is visible", async ({ page }) => {
  const baseURL = currentBaseURL();
  await signIn(page, baseURL, "school-admin");

  await page.goto(tenantUrl(baseURL, PERMISSION_PAGE));
  await expectPageRendered(page, "Permission Explorer");
  await expect(page.getByText("Registry Permission")).toBeVisible();

  // The registry is shown in full by default: a sample of real keys across
  // modules, classifications, and assignability must render.
  await expect(page.getByText("tenant.dashboard.view", { exact: true })).toBeVisible();
  await expect(page.getByText("tenant.permissions.view", { exact: true })).toBeVisible();
  await expect(page.getByText("absensi.attendance.view", { exact: true })).toBeVisible();
  await expect(page.getByText("tenant-assignable", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("school-admin-only", { exact: true }).first()).toBeVisible();

  // The "permission ditampilkan" counter reflects the filtered registry list.
  await expect(page.getByText(/^\d+ permission ditampilkan$/)).toBeVisible();
});

test("guru and siswa are denied direct access to the permission explorer", async ({ page }) => {
  const baseURL = currentBaseURL();
  for (const role of ["guru", "siswa"] as const) {
    await signIn(page, baseURL, role);
    await page.goto(tenantUrl(baseURL, PERMISSION_PAGE));
    await expectPageDenied(page, "Permission Explorer");
    await expect(page.getByText("Registry Permission")).toHaveCount(0);

    await page.goto(tenantUrl(baseURL, "/dashboard"));
    await expectPageRendered(page, "Ringkasan");
    await logout(page);
  }
});
