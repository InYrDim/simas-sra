import assert from "node:assert/strict";
import test from "node:test";

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

  const management = tenantMenuItems.find((item) => item.title === "Manajemen");
  const backupRestore = management?.items?.find((item) => item.title === "Backup & Restore");
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

test("placeholder integration is not presented as an authorized capability", () => {
  const integration = tenantMenuItems.find((item) => item.title === "Integrasi");
  assert.equal(integration, undefined);
});

test("Tenant navigation prefixes every route with the current domain", () => {
  assert.equal(tenantNavigationHref("sekolah-a", "/dashboard"), "/sekolah-a/dashboard");
  assert.equal(tenantNavigationHref("/sekolah-a/", "/master/siswa"), "/sekolah-a/master/siswa");
  assert.equal(tenantNavigationHref("sekolah-a", undefined), "#");

  for (const item of tenantMenuItems.flatMap((entry) => entry.items ?? [entry])) {
    assert.match(tenantNavigationHref("sekolah-a", item.url), /^\/sekolah-a\//, item.title);
  }
});

test("navigation consumes effective permission state and zero-role users see no business items", () => {
  assert.equal(isNavigationItemAuthorized({ requiredPermissions: ["tenant.dashboard.view"] }, new Set()), false);
  assert.equal(isNavigationItemAuthorized({ requiredPermissions: ["tenant.dashboard.view"] }, new Set(["tenant.dashboard.view"])), true);
  assert.equal(isNavigationItemAuthorized({}, new Set()), false);
  assert.equal(isNavigationItemAuthorized({}, new Set(["tenant.users.view"])), true);
  assert.equal(isNavigationItemAuthorized({ requiredPermissions: ["a", "b"], permissionMode: "any" }, new Set(["b"])), true);
});
