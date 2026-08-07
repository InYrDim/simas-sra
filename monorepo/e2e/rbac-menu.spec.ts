import { expect, test } from "@playwright/test";

import {
  currentBaseURL,
  expectPageDenied,
  expectPageRendered,
  logout,
  sdn191Credentials,
  SDN191_DOMAIN,
  SDN191_TENANT_NAME,
  sidebarMenuLabels,
  signIn,
  tenantUrl,
} from "./rbac-helpers";

// VAL-CROSS-001/002/003 — the sidebar menu reflects the role's permissions on
// the SDN 191 tenant. Feature-gated master-data items (Overview / Master Data)
// are governed by VAL-DATA-015 (feature gate) and are NOT part of the RBAC deny
// matrix (mission AGENTS.md); this suite asserts the RBAC module allowlist and
// the absence of the five admin-only placeholder modules.

const ADMIN_ONLY_MODULES = [
  "E-Library",
  "Persuratan",
  "Penjadwalan",
  "PPDB",
  "Ulangan",
  "Import",
  "Manajemen",
] as const;

test("school-admin sees the full RBAC module menu and opens Absensi", async ({ page }) => {
  const baseURL = currentBaseURL();
  await signIn(page, baseURL, "school-admin");

  const labels = await sidebarMenuLabels(page);
  for (const expected of ["Dasbor", "Absensi", "E-Library", "Persuratan", "Overview", "Import", "Penjadwalan", "PPDB", "Ulangan", "Manajemen"]) {
    expect(labels, `menu should contain ${expected}`).toContain(expected);
  }

  // VAL-CROSS-001: admin can open /absensi (200, content renders).
  await page.goto(tenantUrl(baseURL, "/absensi"));
  await expectPageRendered(page, "Absensi");
});

test("guru sees Dasbor + Absensi and none of the admin-only placeholder modules", async ({ page }) => {
  const baseURL = currentBaseURL();
  await signIn(page, baseURL, "guru");

  const labels = await sidebarMenuLabels(page);
  expect(labels).toContain("Dasbor");
  expect(labels).toContain("Absensi");
  for (const adminOnly of ADMIN_ONLY_MODULES) {
    expect(labels, `guru menu must not contain ${adminOnly}`).not.toContain(adminOnly);
  }
  expect(labels).not.toContain("Backup & Restore");
  expect(labels).not.toContain("Jadwal Mengajar");
  expect(labels).not.toContain("Jadwal Events");

  // VAL-CROSS-002: guru can open /absensi (200, content renders).
  await page.goto(tenantUrl(baseURL, "/absensi"));
  await expectPageRendered(page, "Absensi");
});

test("siswa sees the narrowest menu; Absensi is hidden and direct /absensi is denied", async ({ page }) => {
  const baseURL = currentBaseURL();
  await signIn(page, baseURL, "siswa");

  const labels = await sidebarMenuLabels(page);
  expect(labels).toContain("Dasbor");
  expect(labels).not.toContain("Absensi");
  for (const adminOnly of ADMIN_ONLY_MODULES) {
    expect(labels, `siswa menu must not contain ${adminOnly}`).not.toContain(adminOnly);
  }
  expect(labels).not.toContain("Backup & Restore");
  expect(labels).not.toContain("Jadwal Mengajar");
  expect(labels).not.toContain("Jadwal Events");

  // VAL-CROSS-003: direct /absensi for siswa -> deny without content.
  await page.goto(tenantUrl(baseURL, "/absensi"));
  await expectPageDenied(page, "Absensi");
});

test("menu breadth ordering: siswa < guru < school-admin", async ({ page }) => {
  const baseURL = currentBaseURL();
  const counts: Record<string, number> = {};
  for (const role of ["siswa", "guru", "school-admin"] as const) {
    await signIn(page, baseURL, role);
    counts[role] = (await sidebarMenuLabels(page)).length;
    if (role !== "school-admin") {
      // Log out so the next role logs in on a clean session.
      await logout(page);
    }
  }
  expect(counts.siswa).toBeLessThan(counts.guru);
  expect(counts.guru).toBeLessThan(counts["school-admin"]);
});

test("login page names the SDN 191 tenant", async ({ page }) => {
  await page.goto(tenantUrl(currentBaseURL(), "/login"));
  await expect(
    page.getByRole("heading", { name: `Masuk ke ${SDN191_TENANT_NAME}` }),
  ).toBeVisible();
  // Emails are non-secret identifiers wired from the env (with the repo's
  // documented SDN 191 defaults); exercising them here keeps the spec aligned
  // with the provisioned users.
  const guru = sdn191Credentials("guru");
  expect(guru.email).toContain(`@${SDN191_DOMAIN}.simas.test`);
});
