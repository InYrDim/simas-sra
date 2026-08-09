import { expect, test, type Page } from "@playwright/test";

import {
  currentBaseURL,
  expectPageDenied,
  expectPageRendered,
  signIn,
  tenantUrl,
} from "./rbac-helpers";

// VAL-CROSS-005/006 — real navigation through the sidebar menu. Every visible
// RBAC module per role opens at its configured href and renders without
// 404/500/blank; clicking Dasbor returns to the dashboard. Hidden modules are
// covered by rbac-guard.spec.ts (reachability deny matrix).

async function clickSidebarLink(page: Page, name: string): Promise<void> {
  const sidebar = page.locator('[data-slot="sidebar"]').first();
  await sidebar.getByRole("link", { name, exact: true }).click();
}

/**
 * Open nested collapsible sidebar groups (if not already open) and click one
 * sub-link. The group trigger's onClick is attached through React props, so
 * wait for hydration before clicking. The check is idempotent: an already-open
 * group is not toggled again.
 */
async function openGroupAndNavigate(
  page: Page,
  groupNames: readonly string[],
  itemName: string,
  pathRegex: RegExp,
  heading: string,
): Promise<void> {
  const sidebar = page.locator('[data-slot="sidebar"]').first();
  const itemLink = sidebar.getByRole("link", { name: itemName, exact: true });
  if ((await itemLink.count()) === 0) {
    for (const groupName of groupNames) {
      await page.waitForFunction(
        (target) => {
          const buttons = Array.from(document.querySelectorAll("button"));
          return buttons.some(
            (button) =>
              (button.textContent ?? "").trim() === target &&
              Object.keys(button).some((key) => key.startsWith("__reactProps")),
          );
        },
        groupName,
      );
      await sidebar.getByRole("button", { name: groupName, exact: true }).click();
    }
    await expect(itemLink).toBeVisible({ timeout: 20_000 });
  }
  await itemLink.click();
  await expect(page).toHaveURL(pathRegex, { timeout: 30_000 });
  await expectPageRendered(page, heading);
  await clickSidebarLink(page, "Dasbor");
  await expect(page).toHaveURL(/\/dashboard(?:[/?#]|$)/, { timeout: 30_000 });
  await expectPageRendered(page, "Ringkasan");
}

test("school-admin navigates every RBAC module from the sidebar and returns to the dashboard", async ({ page }) => {
  const baseURL = currentBaseURL();
  await signIn(page, baseURL, "school-admin");

  const modules: ReadonlyArray<{ name: string; path: string; heading: string }> = [
    { name: "Absensi", path: "/absensi", heading: "Absensi" },
    { name: "E-Library", path: "/e-library", heading: "E-Library" },
    { name: "Persuratan", path: "/persuratan", heading: "Persuratan" },
  ];

  for (const entry of modules) {
    await clickSidebarLink(page, entry.name);
    await expect(page).toHaveURL(new RegExp(`${entry.path.replace(/\//g, "\\/")}(?:[/?#]|$)`), {
      timeout: 30_000,
    });
    await expectPageRendered(page, entry.heading);
    await clickSidebarLink(page, "Dasbor");
    await expect(page).toHaveURL(/\/dashboard(?:[/?#]|$)/, { timeout: 30_000 });
    await expectPageRendered(page, "Ringkasan");
  }

  // Modules nested inside collapsible groups. "Manajemen" and "Sistem & Keamanan"
  // are section labels (SidebarGroupLabel divs, not buttons); only "Pengguna" is
  // a collapsible trigger that must be opened. Each group is hydrated + opened by
  // openGroupAndNavigate, so a fresh/cold server cannot drop the click.
  await openGroupAndNavigate(page, ["Penjadwalan"], "Jadwal Mengajar", /\/jadwal\/mengajar(?:[/?#]|$)/, "Jadwal Mengajar");
  await openGroupAndNavigate(page, ["Penjadwalan"], "Events", /\/jadwal\/events(?:[/?#]|$)/, "Events");
  await openGroupAndNavigate(page, ["Pengguna"], "Manajemen Akun", /\/users(?:[/?#]|$)/, "Siklus Akun Sekolah");
  await openGroupAndNavigate(page, ["Pengguna"], "Pemberian Role", /\/settings\/assignments(?:[/?#]|$)/, "Assignment role");
  await openGroupAndNavigate(page, ["Pengguna"], "Roles", /\/settings\/roles(?:[/?#]|$)/, "Roles");
  await openGroupAndNavigate(page, ["Pengguna"], "Permission", /\/settings\/permissions(?:[/?#]|$)/, "Permission Explorer");
  // Backup & Restore is a flat item in the "Sistem & Keamanan" section (no
  // collapsible wrapper), so it is clickable without opening a group.
  await openGroupAndNavigate(page, [], "Backup & Restore", /\/settings\/backup-restore(?:[/?#]|$)/, "Backup & Restore");
});

test("guru navigates Dasbor and Absensi; nothing else is clickable", async ({ page }) => {
  const baseURL = currentBaseURL();
  await signIn(page, baseURL, "guru");

  await clickSidebarLink(page, "Absensi");
  await expect(page).toHaveURL(/\/absensi(?:[/?#]|$)/, { timeout: 30_000 });
  await expectPageRendered(page, "Absensi");

  await clickSidebarLink(page, "Dasbor");
  await expect(page).toHaveURL(/\/dashboard(?:[/?#]|$)/, { timeout: 30_000 });
  await expectPageRendered(page, "Ringkasan");
});

test("siswa navigates Dasbor; every other RBAC module is denied", async ({ page }) => {
  const baseURL = currentBaseURL();
  await signIn(page, baseURL, "siswa");

  await clickSidebarLink(page, "Dasbor");
  await expect(page).toHaveURL(/\/dashboard(?:[/?#]|$)/, { timeout: 30_000 });
  await expectPageRendered(page, "Ringkasan");

  // Siswa's only RBAC module besides the dashboard is none: /absensi denies.
  await page.goto(tenantUrl(baseURL, "/absensi"));
  await expectPageDenied(page, "Absensi");
});
