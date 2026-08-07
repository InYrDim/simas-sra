import { expect, test, type Page } from "@playwright/test";

// Shared helpers for the RBAC e2e suite (SDN 191 tenant).
//
// Credentials come from non-committed env vars provisioned by M1
// (monorepo/.env is git-ignored). Emails are non-secret; passwords are read
// from the environment and never printed or committed.

export const SDN191_DOMAIN = "uptd-sdn-191-inpres-batunapara";
export const SDN191_TENANT_NAME = "SDN 191 Inpres Batunapara";

export type Sdn191Role = "school-admin" | "guru" | "siswa";

/** Base URL from the active Playwright project (works with E2E_BASE_URL). */
export function currentBaseURL(): string {
  const base = test.info().project.use.baseURL;
  if (!base) throw new Error("Playwright baseURL is not configured");
  return base;
}

export const SDN191_EMAILS: Record<Sdn191Role, string> = {
  "school-admin": "school-admin@uptd-sdn-191-inpres-batunapara.simas.test",
  guru: "guru@uptd-sdn-191-inpres-batunapara.simas.test",
  siswa: "siswa@uptd-sdn-191-inpres-batunapara.simas.test",
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value?.trim()) {
    throw new Error(`Missing required env var ${name} (non-commit SDN 191 credential)`);
  }
  return value;
}

export function sdn191Credentials(role: Sdn191Role): { email: string; password: string } {
  const passwordVar: Record<Sdn191Role, string> = {
    "school-admin": "SDN191_SCHOOL_ADMIN_PASSWORD",
    guru: "SDN191_GURU_PASSWORD",
    siswa: "SDN191_SISWA_PASSWORD",
  };
  return { email: SDN191_EMAILS[role], password: requireEnv(passwordVar[role]) };
}

/** Build a tenant-subdomain URL from the configured baseURL (port-agnostic). */
export function tenantUrl(baseURL: string, pathname: string, domain: string = SDN191_DOMAIN): string {
  const url = new URL(baseURL);
  url.hostname = `${domain}.localhost`;
  url.pathname = pathname;
  return url.toString();
}

/**
 * Log into the SDN 191 tenant with the given role. Assumes a fresh context
 * (or a logged-out page); lands on /dashboard by default (no continuation).
 */
export async function signIn(page: Page, baseURL: string, role: Sdn191Role): Promise<void> {
  const { email, password } = sdn191Credentials(role);
  await page.goto(tenantUrl(baseURL, "/login"));
  await expect(
    page.getByRole("heading", { name: `Masuk ke ${SDN191_TENANT_NAME}` }),
  ).toBeVisible({ timeout: 30_000 });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Kata Sandi").fill(password);
  // The submit handler is attached through React props; wait for hydration so
  // the real onSubmit (not a raw form POST) runs on click.
  await page.waitForFunction(() => {
    const form = document.querySelector("form");
    return form !== null && Object.keys(form).some((key) => key.startsWith("__reactProps"));
  });
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL(/\/dashboard(?:[/?#]|$)/, { timeout: 60_000 });
  await expect(page.getByRole("heading", { level: 2, name: "Ringkasan" })).toBeVisible();
}

/** Click the sidebar sign-out control and wait for the tenant login page. */
export async function logout(page: Page): Promise<void> {
  // The sign-out handler is attached through React props; wait for hydration so
  // the click actually triggers authClient.signOut (not a no-op on a raw button).
  await page.waitForFunction(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    return buttons.some(
      (button) =>
        (button.textContent ?? "").includes("Keluar") &&
        Object.keys(button).some((key) => key.startsWith("__reactProps")),
    );
  });
  await page.getByRole("button", { name: /Keluar/ }).first().click();
  await expect(page).toHaveURL(/\/login(?:[/?#]|$)/, { timeout: 30_000 });
  await expect(
    page.getByRole("heading", { name: `Masuk ke ${SDN191_TENANT_NAME}` }),
  ).toBeVisible();
}

/** Visible menu labels (links + collapsible triggers) rendered inside the sidebar. */
export async function sidebarMenuLabels(page: Page): Promise<string[]> {
  const sidebar = page.locator('[data-slot="sidebar"]').first();
  const labels = (await sidebar.locator("a, button").allTextContents())
    .map((text) => text.replace(/\s+/g, " ").trim())
    .filter((text) => text && text !== "Keluar" && text !== "KeluarKeluar");
  return [...new Set(labels)];
}

/**
 * Assert a guarded page was denied. In dev mode the guarded page streams a 200
 * shell and swaps in the Next.js forbidden boundary, so the canonical signal is
 * the forbidden UI being present AND the page's own content heading never
 * rendering (see mission library/user-testing.md).
 */
export async function expectPageDenied(page: Page, contentHeading: string | null): Promise<void> {
  await expect(page.getByText("This page could not be accessed.")).toBeVisible({ timeout: 20_000 });
  if (contentHeading) {
    await expect(page.getByRole("heading", { name: contentHeading, exact: true })).toHaveCount(0);
  }
}

/** Assert a page rendered its content (no forbidden boundary swapped in). */
export async function expectPageRendered(page: Page, contentHeading: string): Promise<void> {
  await expect(page.getByRole("heading", { name: contentHeading, exact: true })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText("This page could not be accessed.")).toHaveCount(0);
}
