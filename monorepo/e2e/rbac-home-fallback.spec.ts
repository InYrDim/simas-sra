import "dotenv/config";

import { Pool, type PoolClient } from "pg";
import { expect, test, type Page, type Response } from "@playwright/test";
import { hashPassword } from "better-auth/crypto";

import {
  currentBaseURL,
  expectPageRendered,
  SDN191_TENANT_NAME,
  sdn191Credentials,
  tenantUrl,
} from "./rbac-helpers";

// VAL-WIRE-005 + VAL-CROSS-009 (jalur a) — runtime proof of the permission-aware
// homepage fallback. The three SDN 191 roles all hold tenant.dashboard.view, so
// the non-dashboard branches of resolveTenantHomeRoute can only be exercised
// with temporary synthetic role/user data. tsx unit tests do NOT cross the RSC
// boundary — the original defect compiled the predicate import from a
// "use client" module into a throwing client reference, so only a real render
// proves the redirect/no-access branches work.
//
// Synthetic data is created in beforeAll (after an idempotent cleanup of any
// leftovers from a previous crashed run) and fully removed in afterAll: SDN 191
// returns to exactly its 2 validated roles / 2 assignments and original users.
// Passwords come from non-commit env vars (never literals, never printed).

const TENANT_ID = "sdn19100-0000-4000-8000-000000000001";

const ROLE_ABSENSI_ONLY_ID = "sdn19100-0000-4000-8000-000000000070";
const ROLE_NO_PERM_ID = "sdn19100-0000-4000-8000-000000000071";
const USER_ABSENSI_ONLY_ID = "sdn19100-0000-4000-8000-000000000072";
const USER_NO_PERM_ID = "sdn19100-0000-4000-8000-000000000073";
const ASSIGNMENT_ABSENSI_ONLY_ID = "sdn19100-0000-4000-8000-000000000074";
const ASSIGNMENT_NO_PERM_ID = "sdn19100-0000-4000-8000-000000000075";

const EMAIL_SUFFIX = "@uptd-sdn-191-inpres-batunapara.simas.test";
const USER_ABSENSI_ONLY_EMAIL = `home-fallback-absensi${EMAIL_SUFFIX}`;
const USER_NO_PERM_EMAIL = `home-fallback-noperm${EMAIL_SUFFIX}`;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value?.trim()) throw new Error(`Missing required env var ${name} (non-commit credential)`);
  return value;
}

let pool: Pool | undefined;
let connection: PoolClient | undefined;

async function cleanup(): Promise<void> {
  // No-op when beforeAll failed before the connection was created (e.g. env
  // DB credentials missing): there is nothing to remove and no handle to use.
  if (!connection) return;
  await connection.query("DELETE FROM session WHERE user_id = ANY($1::text[])", [[USER_ABSENSI_ONLY_ID, USER_NO_PERM_ID]]);
  await connection.query("DELETE FROM tenant_role_assignment WHERE tenant_id = $1 AND user_id = ANY($2::text[])", [
    TENANT_ID,
    [USER_ABSENSI_ONLY_ID, USER_NO_PERM_ID],
  ]);
  await connection.query("DELETE FROM tenant_role_permission WHERE tenant_id = $1 AND role_id = ANY($2::text[])", [
    TENANT_ID,
    [ROLE_ABSENSI_ONLY_ID, ROLE_NO_PERM_ID],
  ]);
  await connection.query("DELETE FROM tenant_account_security WHERE tenant_id = $1 AND user_id = ANY($2::text[])", [
    TENANT_ID,
    [USER_ABSENSI_ONLY_ID, USER_NO_PERM_ID],
  ]);
  await connection.query("DELETE FROM account WHERE user_id = ANY($1::text[])", [[USER_ABSENSI_ONLY_ID, USER_NO_PERM_ID]]);
  await connection.query("DELETE FROM tenant_role WHERE tenant_id = $1 AND id = ANY($2::text[])", [
    TENANT_ID,
    [ROLE_ABSENSI_ONLY_ID, ROLE_NO_PERM_ID],
  ]);
  await connection.query('DELETE FROM "user" WHERE id = ANY($1::text[])', [[USER_ABSENSI_ONLY_ID, USER_NO_PERM_ID]]);
}

test.beforeAll(async () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl?.trim()) throw new Error("DATABASE_URL is required");

  const passwordHash = await hashPassword(requireEnv("SDN191_GURU_PASSWORD"));
  pool = new Pool({ connectionString: databaseUrl, max: 1 });
  connection = await pool.connect();
  try {
    // Idempotent: remove leftovers from a crashed previous run first.
    await cleanup();

    await connection.query(
      "INSERT INTO tenant_role (id, tenant_id, name, normalized_name, lifecycle, origin, version, created_at, updated_at) VALUES ($1, $2, $3, $4, 'active', 'scratch', 1, now(), now())",
      [ROLE_ABSENSI_ONLY_ID, TENANT_ID, "Fallback Absensi", "fallback absensi"],
    );
    await connection.query(
      "INSERT INTO tenant_role (id, tenant_id, name, normalized_name, lifecycle, origin, version, created_at, updated_at) VALUES ($1, $2, $3, $4, 'active', 'scratch', 1, now(), now())",
      [ROLE_NO_PERM_ID, TENANT_ID, "Fallback Tanpa Izin", "fallback tanpa izin"],
    );
    // The no-dashboard role holds ONLY absensi.attendance.view.
    await connection.query(
      "INSERT INTO tenant_role_permission (tenant_id, role_id, permission_key, created_at) VALUES ($1, $2, 'absensi.attendance.view', now())",
      [TENANT_ID, ROLE_ABSENSI_ONLY_ID],
    );
    // Synthetic users attached to SDN 191 (tenant_role NULL: authorization
    // comes exclusively from the RBAC assignment).
    await connection.query(
      'INSERT INTO "user" (id, tenant_id, tenant_role, name, email, email_verified, created_at, updated_at) VALUES ($1, $2, NULL, $3, $4, true, now(), now())',
      [USER_ABSENSI_ONLY_ID, TENANT_ID, "Fallback Absensi User", USER_ABSENSI_ONLY_EMAIL],
    );
    await connection.query(
      'INSERT INTO "user" (id, tenant_id, tenant_role, name, email, email_verified, created_at, updated_at) VALUES ($1, $2, NULL, $3, $4, true, now(), now())',
      [USER_NO_PERM_ID, TENANT_ID, "Fallback Tanpa Izin User", USER_NO_PERM_EMAIL],
    );
    for (const userId of [USER_ABSENSI_ONLY_ID, USER_NO_PERM_ID]) {
      // better-auth credential convention: account_id = user id (see
      // tenant-account-lifecycle-data / provision-sdn-191.ts).
      await connection.query(
        "INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at) VALUES ($1, $2, 'credential', $3, $4, now(), now())",
        [userId, userId, userId, passwordHash],
      );
      await connection.query(
        "INSERT INTO tenant_account_security (tenant_id, user_id, lifecycle, version, assignment_version, activated_at, created_at, updated_at) VALUES ($1, $2, 'active', 1, 1, now(), now(), now())",
        [TENANT_ID, userId],
      );
    }
    await connection.query(
      "INSERT INTO tenant_role_assignment (id, tenant_id, user_id, role_id, state, version, assigned_at, updated_at) VALUES ($1, $2, $3, $4, 'active', 1, now(), now())",
      [ASSIGNMENT_ABSENSI_ONLY_ID, TENANT_ID, USER_ABSENSI_ONLY_ID, ROLE_ABSENSI_ONLY_ID],
    );
    await connection.query(
      "INSERT INTO tenant_role_assignment (id, tenant_id, user_id, role_id, state, version, assigned_at, updated_at) VALUES ($1, $2, $3, $4, 'active', 1, now(), now())",
      [ASSIGNMENT_NO_PERM_ID, TENANT_ID, USER_NO_PERM_ID, ROLE_NO_PERM_ID],
    );
  } catch (error) {
    await cleanup();
    connection.release();
    await pool.end();
    // Forget the (now closed) handle so a subsequent afterAll does not run
    // cleanup/end again and mask the original error with a secondary one.
    connection = undefined;
    pool = undefined;
    throw error;
  }
});

test.afterAll(async () => {
  // beforeAll may have failed before creating the connection (e.g. env DB
  // credentials missing). Playwright still runs afterAll in that case; return
  // so the real beforeAll error is the only error reported.
  if (!connection || !pool) return;
  try {
    await cleanup();
  } finally {
    connection.release();
    await pool.end();
  }
});

/** Sign in with arbitrary credentials (synthetic role), landing on the tenant login first. */
async function signInWith(page: Page, baseURL: string, email: string, password: string): Promise<void> {
  await page.goto(tenantUrl(baseURL, "/login"));
  await expect(page.getByRole("heading", { name: `Masuk ke ${SDN191_TENANT_NAME}` })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Kata Sandi").fill(password);
  // The submit handler is attached through React props; wait for hydration so
  // the real onSubmit (not a raw form POST) runs on click.
  await page.waitForFunction(() => {
    const form = document.querySelector("form");
    return form !== null && Object.keys(form).some((key) => key.startsWith("__reactProps"));
  });
  await page.getByRole("button", { name: "Masuk" }).click();
}

/**
 * Watch for server-side crashes during the fallback flow. Any response with a
 * 5xx status (e.g. the old client-reference throw on /dashboard) fails the
 * gate. The listener is registered before sign-in and read after the flow.
 */
function startServerErrorWatch(page: Page): () => number[] {
  const serverErrors: number[] = [];
  const onResponse = (response: Response) => {
    if (response.status() >= 500) serverErrors.push(response.status());
  };
  page.on("response", onResponse);
  return () => {
    page.off("response", onResponse);
    return serverErrors;
  };
}

test("principal without tenant.dashboard.view is redirected to the first allowed page (/absensi) and renders 200", async ({ page }) => {
  const baseURL = currentBaseURL();
  const password = requireEnv("SDN191_GURU_PASSWORD");
  const readServerErrors = startServerErrorWatch(page);

  await signInWith(page, baseURL, USER_ABSENSI_ONLY_EMAIL, password);

  // Default login lands on /dashboard, which must fall back to the first
  // authorized menu page — NOT a 500, 403, blank page, or redirect loop.
  await expect(page).toHaveURL(/\/absensi(?:[/?#]|$)/, { timeout: 60_000 });
  await expectPageRendered(page, "Absensi");
  await expect(page.getByText(/Internal Server Error|Unhandled Runtime Error/)).toHaveCount(0);
  await page.waitForTimeout(500);
  expect(readServerErrors()).toEqual([]);
});

test("principal without any permission renders NoTenantAccess without crashing", async ({ page }) => {
  const baseURL = currentBaseURL();
  const password = requireEnv("SDN191_GURU_PASSWORD");
  const readServerErrors = startServerErrorWatch(page);

  await signInWith(page, baseURL, USER_NO_PERM_EMAIL, password);

  // No dashboard view and no authorized page: stay on /dashboard and render the
  // clear NoTenantAccess state instead of throwing before it can be rendered.
  // (The NoTenantAccess card title is a plain text node, not an ARIA heading.)
  await expect(page).toHaveURL(/\/dashboard(?:[/?#]|$)/, { timeout: 60_000 });
  await expect(page.getByText("Akses belum diberikan")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/belum memiliki Role Tenant aktif/)).toBeVisible();
  await expect(page.getByText("This page could not be accessed.")).toHaveCount(0);
  await expect(page.getByText(/Internal Server Error|Unhandled Runtime Error/)).toHaveCount(0);
  await page.waitForTimeout(500);
  expect(readServerErrors()).toEqual([]);
});

test("SDN 191 guru still lands on /dashboard (no regression after the predicate move)", async ({ page }) => {
  const baseURL = currentBaseURL();
  const cred = sdn191Credentials("guru");

  await signInWith(page, baseURL, cred.email, cred.password);

  await expect(page).toHaveURL(/\/dashboard(?:[/?#]|$)/, { timeout: 60_000 });
  await expectPageRendered(page, "Ringkasan");
  await expect(page.getByText(/Internal Server Error|Unhandled Runtime Error/)).toHaveCount(0);
  // The sidebar still renders the Absensi item for guru (predicate re-export).
  await expect(page.locator('[data-slot="sidebar"]').first().getByRole("link", { name: "Absensi", exact: true })).toBeVisible();
});
