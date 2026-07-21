import assert from "node:assert/strict";
import test from "node:test";

import { tenantMenuItems } from "@/components/tenant-nav-menu/config";
import { tenantNavigationHref } from "@/components/tenant-nav-menu";

const masterData = tenantMenuItems.find((item) => item.title === "Master Data");

test("Master Data and every child menu are visible only to School Admin", () => {
  assert.ok(masterData);
  assert.deepEqual(masterData.roles, ["school-admin"]);
  assert.ok(masterData.items?.length);
  for (const item of masterData.items ?? []) {
    assert.deepEqual(item.roles, ["school-admin"], item.title);
  }
});

test("Administrasi separates Overview, Import, and Master Data", () => {
  const administration = tenantMenuItems.filter((item) => item.group === "Administrasi");

  assert.deepEqual(
    administration.map(({ title, url, roles }) => ({ title, url, roles })),
    [
      { title: "Overview", url: "/master", roles: ["school-admin"] },
      { title: "Import", url: "/master/import", roles: ["school-admin"] },
      { title: "Master Data", url: undefined, roles: ["school-admin"] },
    ],
  );
});

test("Tenant navigation prefixes every route with the current domain", () => {
  assert.equal(tenantNavigationHref("sekolah-a", "/dashboard"), "/sekolah-a/dashboard");
  assert.equal(tenantNavigationHref("/sekolah-a/", "/master/siswa"), "/sekolah-a/master/siswa");
  assert.equal(tenantNavigationHref("sekolah-a", undefined), "#");

  for (const item of tenantMenuItems.flatMap((entry) => entry.items ?? [entry])) {
    assert.match(tenantNavigationHref("sekolah-a", item.url), /^\/sekolah-a\//, item.title);
  }
});
