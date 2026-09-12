import test from "node:test";
import assert from "node:assert/strict";

import {
    TENANT_MENU_KEYS,
    isKnownMenuKey,
    mergeTenantMenuVisibility,
    readTenantMenuVisibility,
    resolveHiddenMenuKeys,
    resolveMenuKeyForPath,
} from "@/lib/features/tenant-menu-visibility";

test("every static menu item and sub-item has a unique key", () => {
    assert.ok(TENANT_MENU_KEYS.length > 0);
    assert.equal(new Set(TENANT_MENU_KEYS).size, TENANT_MENU_KEYS.length, "menu keys must be unique");
    assert.ok(isKnownMenuKey("dashboard"));
    assert.ok(isKnownMenuKey("ppdb-review"));
    assert.equal(isKnownMenuKey("not-a-real-key"), false);
});

test("readTenantMenuVisibility defaults every key to visible", () => {
    const visibility = readTenantMenuVisibility(undefined);
    for (const key of TENANT_MENU_KEYS) assert.equal(visibility[key], true);
});

test("readTenantMenuVisibility honors explicit false and ignores unknown keys", () => {
    const visibility = readTenantMenuVisibility({ menu: { dashboard: false, bogus: false } });
    assert.equal(visibility.dashboard, false);
    assert.equal(visibility.absensi, true);
    assert.equal("bogus" in visibility, false);
});

test("resolveHiddenMenuKeys hides a parent and all its sub-items", () => {
    const visibility = readTenantMenuVisibility({ menu: { ppdb: false } });
    const hidden = resolveHiddenMenuKeys(visibility);
    assert.ok(hidden.has("ppdb"));
    assert.ok(hidden.has("ppdb-review"));
    assert.ok(hidden.has("ppdb-settings"));
    assert.ok(hidden.has("ppdb-riwayat"));
    assert.equal(hidden.has("ulangan"), false);
});

test("resolveHiddenMenuKeys hides an individual sub-item without hiding the parent", () => {
    const visibility = readTenantMenuVisibility({ menu: { "ppdb-review": false } });
    const hidden = resolveHiddenMenuKeys(visibility);
    assert.ok(hidden.has("ppdb-review"));
    assert.equal(hidden.has("ppdb"), false);
    assert.equal(hidden.has("ppdb-settings"), false);
});

test("mergeTenantMenuVisibility only writes known keys", () => {
    const next = mergeTenantMenuVisibility({ menu: { dashboard: false } }, { absensi: false, bogus: false } as Record<string, boolean>);
    const visibility = readTenantMenuVisibility(next);
    assert.equal(visibility.dashboard, false);
    assert.equal(visibility.absensi, false);
    assert.equal(visibility.ulangan, true);
    assert.equal("bogus" in visibility, false);
});

test("resolveMenuKeyForPath matches exact and prefix routes", () => {
    assert.equal(resolveMenuKeyForPath("/dashboard"), "dashboard");
    assert.equal(resolveMenuKeyForPath("/ppdb/settings"), "ppdb-settings");
    assert.equal(resolveMenuKeyForPath("/ppdb/settings/extra"), "ppdb-settings");
    assert.equal(resolveMenuKeyForPath("/master/siswa"), "master-siswa");
    assert.equal(resolveMenuKeyForPath("/unknown/path"), null);
});
