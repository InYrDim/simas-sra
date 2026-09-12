import { expect, test } from "@playwright/test";

import {
  currentBaseURL,
  expectPageDenied,
  expectPageRendered,
  signIn,
  tenantUrl,
} from "./rbac-helpers";

// VAL-WIRE-002/004 + VAL-CROSS-006/012 — server-side page guards and the
// canonical direct-URL deny matrix for the SDN 191 tenant. The four admin-only
// placeholder modules (e-library, persuratan, jadwal/mengajar, jadwal/events),
// settings/backup-restore, and the integrasi module (/integrasi, which now
// carries the WhatsApp Bot control inline) must deny for guru/siswa without
// rendering any content; /absensi denies for siswa only.

const MODULES: ReadonlyArray<{ path: string; heading: string | null }> = [
  { path: "/absensi", heading: "Absensi" },
  { path: "/e-library", heading: "E-Library" },
  { path: "/persuratan", heading: "Persuratan" },
  { path: "/jadwal/mengajar", heading: "Jadwal Mengajar" },
  { path: "/jadwal/events", heading: "Events" },
  { path: "/settings/backup-restore", heading: "Backup & Restore" },
  { path: "/integrasi", heading: "Integrasi" },
];

test("school-admin can open every RBAC module page", async ({ page }) => {
  const baseURL = currentBaseURL();
  await signIn(page, baseURL, "school-admin");

  for (const entry of MODULES) {
    await page.goto(tenantUrl(baseURL, entry.path));
    if (entry.heading) {
      await expectPageRendered(page, entry.heading);
    } else {
      await expect(page.getByText("This page could not be accessed.")).toHaveCount(0);
    }
  }

  await page.goto(tenantUrl(baseURL, "/dashboard"));
  await expectPageRendered(page, "Ringkasan");
});

test("guru is denied on every admin-only placeholder page", async ({ page }) => {
  const baseURL = currentBaseURL();
  await signIn(page, baseURL, "guru");

  for (const entry of MODULES) {
    if (entry.path === "/absensi") continue; // guru is allowed on Absensi
    await page.goto(tenantUrl(baseURL, entry.path));
    await expectPageDenied(page, entry.heading);
  }
});

test("siswa is denied on Absensi and every admin-only placeholder page", async ({ page }) => {
  const baseURL = currentBaseURL();
  await signIn(page, baseURL, "siswa");

  for (const entry of MODULES) {
    await page.goto(tenantUrl(baseURL, entry.path));
    await expectPageDenied(page, entry.heading);
  }
});
