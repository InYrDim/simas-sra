import "dotenv/config";

import mysql, { type Connection } from "mysql2/promise";
import { expect, test, type Locator, type Page } from "@playwright/test";

import {
  currentBaseURL,
  expectPageDenied,
  expectPageRendered,
  logout,
  sidebarMenuLabels,
  signIn,
  tenantUrl,
} from "./rbac-helpers";

// VAL-ROLES-005/006 — the tenant "Roles" page Description column:
//   - A role created through the UI with a non-empty description stores it and
//     shows it in the list AND in the Inspect dialog.
//   - Editing the role's description persists and updates both surfaces.
//   - The pre-existing SDN 191 roles (Guru, Siswa) have NULL descriptions and
//     must keep rendering normally (no 500 / no crash / empty column).
//
//  A temporary "Role Uji Deskripsi" role is created through the UI and removed
//  again at the end (mysql2 cleanup) so SDN 191 returns to exactly 2 roles
//  (Guru, Siswa) and 2 active assignments. Guru/Siswa are never modified.

const TENANT_ID = "sdn19100-0000-4000-8000-000000000001";
const ROLE_NAME = "Role Uji Deskripsi";
const ROLE_NORMALIZED_NAME = "role uji deskripsi";
const ROLE_KEY = "academic-years.years.view";
const DESCRIPTION_CREATE = "Role uji deskripsi untuk validasi e2e Roles";
const DESCRIPTION_EDITED = "Deskripsi role uji setelah diedit";

let connection: Connection | undefined;

/** Full cleanup of the temporary role and its audit trail (idempotent). */
async function cleanupTestRole(): Promise<void> {
  if (!connection) return;
  const [roleRows] = await connection.execute(
    "SELECT id FROM tenant_role WHERE tenant_id = ? AND normalized_name = ?",
    [TENANT_ID, ROLE_NORMALIZED_NAME],
  );
  for (const row of roleRows as Array<{ id: string }>) {
    const roleId = row.id;
    const [eventRows] = await connection.execute(
      "SELECT command_id FROM security_audit_event WHERE tenant_id = ? AND target_role_id = ?",
      [TENANT_ID, roleId],
    );
    const commandIds = (eventRows as Array<{ command_id: string }>).map((item) => item.command_id);
    if (commandIds.length > 0) {
      // mysql2 `execute` does NOT expand arrays for `IN (?)`; build explicit
      // placeholders so the linked commands are actually removed.
      const placeholders = commandIds.map(() => "?").join(", ");
      await connection.execute(
        `DELETE FROM security_outbox WHERE tenant_id = ? AND command_id IN (${placeholders})`,
        [TENANT_ID, ...commandIds],
      );
      await connection.execute(
        "DELETE FROM security_audit_event WHERE tenant_id = ? AND target_role_id = ?",
        [TENANT_ID, roleId],
      );
      await connection.execute(
        `DELETE FROM security_command WHERE tenant_id = ? AND id IN (${placeholders})`,
        [TENANT_ID, ...commandIds],
      );
    } else {
      await connection.execute(
        "DELETE FROM security_audit_event WHERE tenant_id = ? AND target_role_id = ?",
        [TENANT_ID, roleId],
      );
    }
    await connection.execute(
      "DELETE FROM tenant_role_permission WHERE tenant_id = ? AND role_id = ?",
      [TENANT_ID, roleId],
    );
    await connection.execute(
      "DELETE FROM tenant_role WHERE tenant_id = ? AND id = ?",
      [TENANT_ID, roleId],
    );
  }

  // Sweep orphaned role-lifecycle commands left behind by a previous crashed
  // run whose audit events were already removed (no FK target to find them).
  const [orphanRows] = await connection.execute(
    `SELECT c.id FROM security_command c
     LEFT JOIN security_audit_event e
       ON e.security_context_kind = c.security_context_kind
      AND e.context_id = c.context_id
      AND e.command_id = c.id
     WHERE c.tenant_id = ?
       AND c.command_name IN ('tenant-role.create', 'tenant-role.edit-description', 'tenant-role.archive')
       AND e.id IS NULL`,
    [TENANT_ID],
  );
  const orphanIds = (orphanRows as Array<{ id: string }>).map((item) => item.id);
  if (orphanIds.length > 0) {
    const placeholders = orphanIds.map(() => "?").join(", ");
    await connection.execute(
      `DELETE FROM security_outbox WHERE tenant_id = ? AND command_id IN (${placeholders})`,
      [TENANT_ID, ...orphanIds],
    );
    await connection.execute(
      `DELETE FROM security_command WHERE tenant_id = ? AND id IN (${placeholders})`,
      [TENANT_ID, ...orphanIds],
    );
  }
}

test.beforeAll(async () => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl?.trim()) throw new Error("DATABASE_URL is required");
  connection = await mysql.createConnection({ uri: databaseUrl });
  try {
    // Remove leftovers from a previously crashed run so createRole never hits
    // the normalized-name uniqueness constraint.
    await cleanupTestRole();
  } catch (error) {
    await connection.end();
    connection = undefined;
    throw error;
  }
});

test.afterAll(async () => {
  if (!connection) return;
  try {
    await cleanupTestRole();
  } finally {
    await connection.end();
  }
});

/** Wait for React hydration on a button whose accessible name contains `target`. */
async function clickHydratedButton(page: Page, name: string): Promise<void> {
  await page.waitForFunction(
    (target) => {
      const buttons = Array.from(document.querySelectorAll("button"));
      return buttons.some(
        (button) =>
          (button.textContent ?? "").trim().includes(target) &&
          Object.keys(button).some((key) => key.startsWith("__reactProps")),
      );
    },
    name,
  );
  await page.getByRole("button", { name, exact: true }).click();
}

/** The table row for the temporary test role. */
function roleRow(page: Page): Locator {
  return page
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name: ROLE_NAME, exact: true }) });
}

/** Close a dialog through its in-form button (the dialog X also matches "Close"). */
async function closeDialog(dialog: Locator): Promise<void> {
  await dialog.getByRole("button", { name: "Close", exact: true }).first().click();
}

test("VAL-ROLES-005: create a role with a description, see it in list + Inspect, edit it and see the change persist", async ({ page }) => {
  const baseURL = currentBaseURL();
  await signIn(page, baseURL, "school-admin");
  await page.goto(tenantUrl(baseURL, "/settings/roles"));
  await expectPageRendered(page, "Roles");

  // --- Create the temporary role with one valid key + a description. ---
  await clickHydratedButton(page, "Create Role");
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Role Name").fill(ROLE_NAME);
  await dialog.getByLabel("Description").fill(DESCRIPTION_CREATE);
  const keyCheckbox = dialog.getByRole("checkbox", { name: "Lihat Tahun ajaran", exact: true });
  await keyCheckbox.scrollIntoViewIfNeeded();
  await keyCheckbox.click();
  await expect(keyCheckbox).toBeChecked();
  await dialog.getByRole("button", { name: "Save Changes" }).click();

  // The row appears with the description rendered in the Description column.
  const createdRow = roleRow(page);
  await expect(createdRow).toBeVisible({ timeout: 30_000 });
  await expect(
    createdRow.getByRole("cell", { name: DESCRIPTION_CREATE, exact: true }),
  ).toBeVisible();
  await expect(createdRow.getByRole("cell", { name: "draft", exact: true })).toBeVisible();

  // The description is persisted in the DB on the role row.
  const [roleRows] = await connection!.execute(
    "SELECT description FROM tenant_role WHERE tenant_id = ? AND normalized_name = ?",
    [TENANT_ID, ROLE_NORMALIZED_NAME],
  );
  const stored = roleRows as Array<{ description: string | null }>;
  expect(stored.length).toBe(1);
  expect(stored[0].description).toBe(DESCRIPTION_CREATE);

  // The single permission key is persisted too (same valid-key flow as before).
  const [permissionRows] = await connection!.execute(
    "SELECT permission_key FROM tenant_role_permission WHERE tenant_id = ? AND role_id = (SELECT id FROM tenant_role WHERE tenant_id = ? AND normalized_name = ?)",
    [TENANT_ID, TENANT_ID, ROLE_NORMALIZED_NAME],
  );
  expect((permissionRows as Array<{ permission_key: string }>).map((row) => row.permission_key)).toContain(ROLE_KEY);

  // --- Inspect dialog also shows the description. ---
  await createdRow.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("menuitem", { name: "Inspect", exact: true }).click();
  let inspectDialog = page.getByRole("dialog");
  await expect(
    inspectDialog.getByRole("heading", { name: "Inspect Role", exact: true }),
  ).toBeVisible();
  await expect(inspectDialog.getByLabel("Description")).toHaveValue(DESCRIPTION_CREATE);
  await closeDialog(inspectDialog);

  // --- Edit the role: change only the description, save. ---
  await createdRow.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("menuitem", { name: "Edit", exact: true }).click();
  dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Edit Role", exact: true })).toBeVisible();
  await expect(dialog.getByLabel("Description")).toHaveValue(DESCRIPTION_CREATE);
  await dialog.getByLabel("Description").fill(DESCRIPTION_EDITED);
  await dialog.getByRole("button", { name: "Save Changes" }).click();

  // The list column and the DB now show the edited description.
  await expect(createdRow.getByRole("cell", { name: DESCRIPTION_EDITED, exact: true })).toBeVisible({
    timeout: 30_000,
  });
  const [editedRows] = await connection!.execute(
    "SELECT description FROM tenant_role WHERE tenant_id = ? AND normalized_name = ?",
    [TENANT_ID, ROLE_NORMALIZED_NAME],
  );
  expect((editedRows as Array<{ description: string | null }>)[0].description).toBe(DESCRIPTION_EDITED);

  // Inspect also shows the edited description.
  await createdRow.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("menuitem", { name: "Inspect", exact: true }).click();
  inspectDialog = page.getByRole("dialog");
  await expect(inspectDialog.getByLabel("Description")).toHaveValue(DESCRIPTION_EDITED);
  await closeDialog(inspectDialog);
});

test("VAL-ROLES-005/006: guru and siswa stay denied, and an admin sees the role list render with NULL descriptions", async ({ page }) => {
  const baseURL = currentBaseURL();
  for (const role of ["guru", "siswa"] as const) {
    await signIn(page, baseURL, role);
    const labels = await sidebarMenuLabels(page);
    expect(labels, `${role} menu must not contain Roles`).not.toContain("Roles");

    await page.goto(tenantUrl(baseURL, "/settings/roles"));
    await expectPageDenied(page, "Roles");
    await expect(page.getByRole("button", { name: "Create Role", exact: true })).toHaveCount(0);

    await page.goto(tenantUrl(baseURL, "/dashboard"));
    await expectPageRendered(page, "Ringkasan");
    await logout(page);
  }

  // Admin: Guru/Siswa have NULL descriptions and the page renders normally
  // (no 500, no crash, no forbidden boundary). Description cells stay empty.
  await signIn(page, baseURL, "school-admin");
  await page.goto(tenantUrl(baseURL, "/settings/roles"));
  await expectPageRendered(page, "Roles");

  for (const name of ["Guru", "Siswa"]) {
    const row = page
      .getByRole("row")
      .filter({ has: page.getByRole("cell", { name, exact: true }) });
    await expect(row).toBeVisible();
    const descriptionCell = row.getByRole("cell").nth(1);
    await expect(descriptionCell).toHaveText("");
  }
  await expect(page.getByText("This page could not be accessed.")).toHaveCount(0);
});

test("cleanup restores SDN 191 to exactly 2 roles and 2 assignments", async ({ page }) => {
  void page;
  await cleanupTestRole();

  const [roleRows] = await connection!.execute(
    "SELECT name, lifecycle, description FROM tenant_role WHERE tenant_id = ? ORDER BY name",
    [TENANT_ID],
  );
  const roles = roleRows as Array<{ name: string; lifecycle: string; description: string | null }>;
  expect(roles.length).toBe(2);
  expect(roles.map((role) => role.name)).toEqual(["Guru", "Siswa"]);
  expect(roles.every((role) => role.lifecycle === "active")).toBe(true);
  // Existing roles keep their NULL description untouched by the feature.
  expect(roles.every((role) => role.description === null)).toBe(true);

  const [assignRows] = await connection!.execute(
    "SELECT COUNT(*) AS n FROM tenant_role_assignment WHERE tenant_id = ? AND state = 'active'",
    [TENANT_ID],
  );
  expect((assignRows as Array<{ n: number }>)[0].n).toBe(2);

  const [leftover] = await connection!.execute(
    "SELECT COUNT(*) AS n FROM tenant_role WHERE tenant_id = ? AND normalized_name = ?",
    [TENANT_ID, ROLE_NORMALIZED_NAME],
  );
  expect((leftover as Array<{ n: number }>)[0].n).toBe(0);
});
