import test from "node:test";
import assert from "node:assert/strict";

import { type TenantNavItem } from "@/types/components/TenantNavItem";
import { tenantMenuItems } from "@/components/tenant-nav-menu/config";
import { tenantNavigationHref } from "@/components/tenant-nav-menu";
import { isNavigationItemAuthorized } from "@/lib/authorization/tenant-nav-item-authorization";

const masterData = tenantMenuItems.find((item) => item.title === "Master Data");

test("Master Data and every child menu use effective permissions", () => {
  assert.ok(masterData);
  assert.ok(masterData.items?.length);
  for (const item of masterData.items ?? []) {
    assert.ok(item.requiredPermissions?.length, item.title);
  }
});

test("Administrasi separates Overview, Import, and Master Data", () => {
  const administration = tenantMenuItems.filter((item) => item.group === "Administrasi");

  assert.deepEqual(
    administration.map(({ title, url }) => ({ title, url })),
    [
      { title: "Overview", url: "/master" },
      { title: "Import", url: "/master/import" },
      { title: "Master Data", url: undefined },
    ],
  );
  assert.ok(administration.every((item) => item.feature === "masterDataRead"));
});

test("Absensi navigation is gated by the absensi feature", () => {
  const absensi = tenantMenuItems.find((item) => item.title === "Absensi");
  assert.ok(absensi);
  assert.equal(absensi?.feature, "absensi");
  assert.deepEqual(absensi?.requiredPermissions, ["absensi.attendance.view"]);
});

test("admin-only placeholder navigation requires tenant.authorization-audit.view", () => {
  const adminOnlyKey = ["tenant.authorization-audit.view"];

  const eLibrary = tenantMenuItems.find((item) => item.title === "E-Library");
  assert.deepEqual(eLibrary?.requiredPermissions, adminOnlyKey);
  assert.equal(isNavigationItemAuthorized(eLibrary!, new Set()), false);
  assert.equal(isNavigationItemAuthorized(eLibrary!, new Set(["tenant.authorization-audit.view"])), true);
  assert.equal(isNavigationItemAuthorized(eLibrary!, new Set(["tenant.dashboard.view"])), false);

  const persuratan = tenantMenuItems.find((item) => item.title === "Persuratan");
  assert.deepEqual(persuratan?.requiredPermissions, adminOnlyKey);
  assert.equal(isNavigationItemAuthorized(persuratan!, new Set()), false);
  assert.equal(isNavigationItemAuthorized(persuratan!, new Set(["tenant.authorization-audit.view"])), true);

  const penjadwalan = tenantMenuItems.find((item) => item.title === "Penjadwalan");
  const jadwalMengajar = penjadwalan?.items?.find((item) => item.title === "Jadwal Mengajar");
  const jadwalEvents = penjadwalan?.items?.find((item) => item.title === "Events");
  assert.deepEqual(jadwalMengajar?.requiredPermissions, adminOnlyKey);
  assert.deepEqual(jadwalEvents?.requiredPermissions, adminOnlyKey);
  assert.equal(isNavigationItemAuthorized(jadwalMengajar!, new Set()), false);
  assert.equal(isNavigationItemAuthorized(jadwalEvents!, new Set(["tenant.authorization-audit.view"])), true);

  const backupRestore = tenantMenuItems.find((item) => item.title === "Backup & Restore");
  assert.deepEqual(backupRestore?.requiredPermissions, adminOnlyKey);
  assert.equal(isNavigationItemAuthorized(backupRestore!, new Set(["tenant.dashboard.view"])), false);
  assert.equal(isNavigationItemAuthorized(backupRestore!, new Set(["tenant.authorization-audit.view"])), true);
});

test("Absensi attendance menu is gated by absensi.attendance.view", () => {
  const absensi = tenantMenuItems.find((item) => item.title === "Absensi");

  assert.ok(absensi);
  assert.equal(absensi?.url, "/absensi");
  assert.deepEqual(absensi?.requiredPermissions, ["absensi.attendance.view"]);
  assert.equal(isNavigationItemAuthorized({ requiredPermissions: ["absensi.attendance.view"] }, new Set()), false);
  assert.equal(
    isNavigationItemAuthorized({ requiredPermissions: ["absensi.attendance.view"] }, new Set(["tenant.dashboard.view"])),
    false,
  );
  assert.equal(
    isNavigationItemAuthorized({ requiredPermissions: ["absensi.attendance.view"] }, new Set(["absensi.attendance.view"])),
    true,
  );
});

test("navigation falls back to any member when requiredPermissions is empty", () => {
  assert.equal(isNavigationItemAuthorized({ requiredPermissions: [] }, new Set()), false);
  assert.equal(isNavigationItemAuthorized({ requiredPermissions: [] }, new Set(["tenant.users.view"])), true);
});

test("Roles menu item lives under the Manajemen > Pengguna collapsible", () => {
  const pengguna = tenantMenuItems.find((item) => item.title === "Pengguna");
  assert.ok(pengguna, "Pengguna collapsible must exist");

  const rolesItem = pengguna?.items?.find((item) => item.title === "Roles");
  assert.ok(rolesItem, "Roles item must exist inside Pengguna");
  assert.equal(rolesItem?.url, "/settings/roles");
  assert.deepEqual(rolesItem?.requiredPermissions, ["tenant.roles.list"]);
  assert.equal(isNavigationItemAuthorized(rolesItem!, new Set()), false);
  assert.equal(isNavigationItemAuthorized(rolesItem!, new Set(["tenant.dashboard.view"])), false);
  assert.equal(isNavigationItemAuthorized(rolesItem!, new Set(["tenant.roles.list"])), true);
});

test("school-admin sidebar contains the redesigned management structure", () => {
  const labels = new Set([
    ...tenantMenuItems.map((item) => item.title),
    ...tenantMenuItems.map((item) => item.group ?? ""),
    ...tenantMenuItems.flatMap((item) => item.items?.map((child) => child.title) ?? []),
    ...tenantMenuItems.flatMap((item) => item.items?.flatMap((child) => child.items?.map((grandChild) => grandChild.title) ?? []) ?? []),
  ]);

  assert.ok(labels.has("Manajemen"));
  assert.ok(labels.has("Pengguna"));
  assert.ok(labels.has("Manajemen Akun"));
  assert.ok(labels.has("Pemberian Role"));
  assert.ok(labels.has("Roles"));
  assert.ok(labels.has("Permission"));
  assert.ok(labels.has("Sistem & Keamanan"));
  assert.ok(labels.has("Riwayat Keamanan"));
  assert.ok(labels.has("Pengaturan Sistem"));
  assert.ok(labels.has("Backup & Restore"));
});

test("Tenant navigation prefixes every route with the current domain", () => {
  assert.equal(tenantNavigationHref("sekolah-a", "/dashboard"), "/sekolah-a/dashboard");
  assert.equal(tenantNavigationHref("/sekolah-a/", "/master/siswa"), "/sekolah-a/master/siswa");
  assert.equal(tenantNavigationHref("sekolah-a", undefined), "#");

  for (const item of tenantMenuItems.flatMap((entry) => entry.items ?? [entry])) {
    if (!item.url) continue;
    assert.match(tenantNavigationHref("sekolah-a", item.url), /^\/sekolah-a\//, item.title);
  }
});

function leafVisible(item: TenantNavItem, permissions: ReadonlySet<string>): boolean {
  if (item.items?.length) return item.items.some((child) => leafVisible(child, permissions))
  return isNavigationItemAuthorized(item, permissions)
}

test("non-admin permissions hide the redesigned management sections", () => {
  const permissions = new Set(["tenant.dashboard.view", "absensi.attendance.view"]);
  const visible = tenantMenuItems.filter((item) => leafVisible(item, permissions));

  assert.equal(visible.some((item) => item.title === "Pengguna"), false);
  assert.equal(visible.some((item) => item.group === "Manajemen"), false);
  assert.equal(visible.some((item) => item.title === "Permission"), false);
  assert.equal(visible.some((item) => item.group === "Sistem & Keamanan"), false);
  assert.equal(visible.some((item) => item.title === "Riwayat Keamanan"), false);
  assert.equal(visible.some((item) => item.title === "Pengaturan Sistem"), false);
});

test("Manajemen and Sistem & Keamanan expose the redesigned management labels", () => {
  const pengguna = tenantMenuItems.find((item) => item.title === "Pengguna");
  assert.ok(pengguna, "Pengguna collapsible must exist");
  assert.equal(pengguna?.group, "Manajemen");
  assert.deepEqual(
    pengguna.items?.map((item) => ({ title: item.title, url: item.url, requiredPermissions: item.requiredPermissions })),
    [
      { title: "Manajemen Akun", url: "/users", requiredPermissions: ["tenant.users.view"] },
      { title: "Pemberian Role", url: "/settings/assignments", requiredPermissions: ["tenant.assignments.view"] },
      { title: "Roles", url: "/settings/roles", requiredPermissions: ["tenant.roles.list"] },
      { title: "Permission", url: "/settings/permissions", requiredPermissions: ["tenant.permissions.view"] },
    ],
  );

  const securitySystem = tenantMenuItems.filter((item) => item.group === "Sistem & Keamanan");
  assert.ok(securitySystem.length > 0, "Sistem & Keamanan group items must exist");
  assert.equal(securitySystem.some((item) => item.items?.length), false, "Sistem & Keamanan items must be flat");
  assert.deepEqual(
    securitySystem.map((item) => ({ title: item.title, url: item.url })),
    [
      { title: "Riwayat Keamanan", url: "/security-history" },
      { title: "Pengaturan Sistem", url: "/settings" },
      { title: "Backup & Restore", url: "/settings/backup-restore" },
    ],
  );
});
