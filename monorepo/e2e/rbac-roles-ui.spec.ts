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

// VAL-ROLES-001..004 — the tenant "Roles" UI:
//   - The sidebar gains school-admin-only "Roles" in the Manajemen group and it
//     really navigates to /settings/roles where the SDN 191 role list renders.
//   - guru/siswa never see the item, and a direct /settings/roles visit denies
//     without any content.
//   - The Create Role dialog lists REAL registry permissions (never the old
//     hardcoded placeholders), so creating a role with one valid key works.
//   - The only way to "delete" is Archive: a userCount 0 role stays with status
//     archived (never deleted); a role in use refuses to archive without data.
//
//  A temporary "Role Uji E2E" is created through the UI and removed again at
//  the end (mysql2 cleanup) so SDN 191 returns to exactly 2 roles (Guru, Siswa)
//  and 2 assignments. The guru/siswa roles are never modified.

const TENANT_ID = "sdn19100-0000-4000-8000-000000000001";
const ROLE_NAME = "Role Uji E2E";
const ROLE_NORMALIZED_NAME = "role uji e2e";
const ROLE_KEY = "academic-years.years.view";

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
       AND c.command_name IN ('tenant-role.create', 'tenant-role.archive')
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

/** Open a collapsible sidebar group (hydration-safe) and click one sub-link. */
async function openGroupAndNavigate(
  page: Page,
  groupName: string,
  itemName: string,
  pathRegex: RegExp,
  heading: string,
): Promise<void> {
  const sidebar = page.locator('[data-slot="sidebar"]').first();
  const itemLink = sidebar.getByRole("link", { name: itemName, exact: true });
  if ((await itemLink.count()) === 0) {
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
    await expect(itemLink).toBeVisible({ timeout: 20_000 });
  }
  await itemLink.click();
  await expect(page).toHaveURL(pathRegex, { timeout: 30_000 });
  await expectPageRendered(page, heading);
}

/** The table row for the temporary test role. */
function roleRow(page: Page): Locator {
  return page
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name: ROLE_NAME, exact: true }) });
}

test("VAL-ROLES-001/002: school-admin sees Roles in the sidebar and the roles page renders the SDN 191 list", async ({ page }) => {
  const baseURL = currentBaseURL();
  await signIn(page, baseURL, "school-admin");

  const labels = await sidebarMenuLabels(page);
  expect(labels, "admin sidebar must contain the Manajemen group").toContain("Manajemen");

  // "Roles" is a sub-item of the collapsed "Pengguna" collapsible (which sits in
  // the "Manajemen" section), so opening the collapsible through the sidebar and
  // clicking the link proves the item is present AND that real navigation
  // reaches the rendered page.
  await openGroupAndNavigate(page, "Pengguna", "Roles", /\/settings\/roles(?:[/?#]|$)/, "Roles");

  // The SDN 191 role list (Guru & Siswa) renders with status and counts plus the
  // Create Role button.
  await expect(page.getByRole("cell", { name: "Guru", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Siswa", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create Role", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "active", exact: true }).first()).toBeVisible();
});

test("VAL-ROLES-003: the create dialog exposes real registry keys, never the placeholders", async ({ page }) => {
  const baseURL = currentBaseURL();
  await signIn(page, baseURL, "school-admin");
  await page.goto(tenantUrl(baseURL, "/settings/roles"));
  await expectPageRendered(page, "Roles");

  await clickHydratedButton(page, "Create Role");
  const dialog = page.getByRole("dialog");

  // A real tenant-assignable registry key shows inside the dialog. The Base UI
  // checkbox renders a visible span (role=checkbox) plus a hidden input; the
  // role locator targets only the visible control.
  await expect(dialog.getByRole("checkbox", { name: "Lihat Tahun ajaran", exact: true })).toBeVisible();
  await expect(dialog.getByText("academic-years.years.view", { exact: true })).toBeVisible();
  // The old hardcoded placeholders must be gone.
  for (const placeholder of ["public.read", "class.read", "class.write", "grade.read", "grade.write"]) {
    await expect(page.getByText(placeholder, { exact: true })).toHaveCount(0);
  }
});

test("VAL-ROLES-003/004: create a role with one valid key, archive stays archived, in-use role refuses archive", async ({ page }) => {
  const baseURL = currentBaseURL();
  await signIn(page, baseURL, "school-admin");
  await page.goto(tenantUrl(baseURL, "/settings/roles"));
  await expectPageRendered(page, "Roles");

  // --- Create the temporary role with exactly one valid registry key. ---
  await clickHydratedButton(page, "Create Role");
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Role Name").fill(ROLE_NAME);
  await dialog.getByLabel("Description").fill("Role uji untuk validasi e2e Roles UI");
  const keyCheckbox = dialog.getByRole("checkbox", { name: "Lihat Tahun ajaran", exact: true });
  await keyCheckbox.scrollIntoViewIfNeeded();
  await keyCheckbox.click();
  await expect(keyCheckbox).toBeChecked();
  await dialog.getByRole("button", { name: "Save Changes" }).click();

  // The row appears with the role in draft and the single key persisted.
  const createdRow = roleRow(page);
  await expect(createdRow).toBeVisible({ timeout: 30_000 });
  await expect(createdRow.getByRole("cell", { name: "draft", exact: true })).toBeVisible();

  const [permissionRows] = await connection!.execute(
    "SELECT permission_key FROM tenant_role_permission WHERE tenant_id = ? AND role_id = (SELECT id FROM tenant_role WHERE tenant_id = ? AND normalized_name = ?)",
    [TENANT_ID, TENANT_ID, ROLE_NORMALIZED_NAME],
  );
  expect((permissionRows as Array<{ permission_key: string }>).map((row) => row.permission_key)).toContain(ROLE_KEY);

  // --- Archive the userCount==0 role: it must STAY in the list as archived. ---
  await createdRow.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("menuitem", { name: "Archive", exact: true }).click();
  await expect(createdRow.getByRole("cell", { name: "archived", exact: true })).toBeVisible({ timeout: 20_000 });

  const [archivedRows] = await connection!.execute(
    "SELECT lifecycle FROM tenant_role WHERE tenant_id = ? AND normalized_name = ?",
    [TENANT_ID, ROLE_NORMALIZED_NAME],
  );
  const archived = archivedRows as Array<{ lifecycle: string }>;
  expect(archived.length).toBe(1);
  expect(archived[0].lifecycle).toBe("archived");
  // Not deleted: the row and the DB row both still exist.

  // --- The in-use Guru role (userCount > 0) must refuse to archive. ---
  const guruRow = page
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name: "Guru", exact: true }) });
  await guruRow.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("menuitem", { name: "Archive", exact: true })).toBeDisabled();

  const [guruRows] = await connection!.execute(
    "SELECT lifecycle FROM tenant_role WHERE tenant_id = ? AND normalized_name = 'guru'",
    [TENANT_ID],
  );
  expect((guruRows as Array<{ lifecycle: string }>)[0].lifecycle).toBe("active");
});

test("VAL-ROLES-001: guru and siswa do not see Roles and direct /settings/roles denies without content", async ({ page }) => {
  const baseURL = currentBaseURL();
  for (const role of ["guru", "siswa"] as const) {
    await signIn(page, baseURL, role);
    const labels = await sidebarMenuLabels(page);
    expect(labels, `${role} menu must not contain Roles`).not.toContain("Roles");
    expect(labels, `${role} menu must not expose the Manajemen group`).not.toContain("Manajemen");

    await page.goto(tenantUrl(baseURL, "/settings/roles"));
    await expectPageDenied(page, "Roles");
    await expect(page.getByRole("button", { name: "Create Role", exact: true })).toHaveCount(0);

    await page.goto(tenantUrl(baseURL, "/dashboard"));
    await expectPageRendered(page, "Ringkasan");
    await logout(page);
  }
});

test("cleanup restores SDN 191 to exactly 2 roles and 2 assignments", async ({ page }) => {
  void page;
  await cleanupTestRole();

  const [roleRows] = await connection!.execute(
    "SELECT name, lifecycle FROM tenant_role WHERE tenant_id = ? ORDER BY name",
    [TENANT_ID],
  );
  const roles = roleRows as Array<{ name: string; lifecycle: string }>;
  expect(roles.length).toBe(2);
  expect(roles.map((role) => role.name)).toEqual(["Guru", "Siswa"]);
  expect(roles.every((role) => role.lifecycle === "active")).toBe(true);

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
