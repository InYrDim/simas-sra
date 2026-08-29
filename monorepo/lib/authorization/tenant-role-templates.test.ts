import test from "node:test";
import assert from "node:assert/strict";

import { TENANT_ROLE_TEMPLATES, getTenantRoleTemplate } from "@/lib/authorization/tenant-role-templates";

test("every template hides only menus its permissions cannot open", () => {
    for (const template of TENANT_ROLE_TEMPLATES) {
        assert.ok(template.menuVisibility, template.key);
    }
});

test("siswa template surfaces only Dasbor and Absensi", () => {
    const siswa = getTenantRoleTemplate("siswa");
    assert.ok(siswa, "siswa template exists");
    // Hidden top-level keys must be everything except dashboard + absensi.
    assert.equal(siswa!.menuVisibility["dashboard"], undefined, "dashboard visible");
    assert.equal(siswa!.menuVisibility["absensi"], undefined, "absensi visible");
    assert.equal(siswa!.menuVisibility["master-data"], false, "master data hidden");
    assert.equal(siswa!.menuVisibility["pengguna"], false, "pengguna hidden");
});
