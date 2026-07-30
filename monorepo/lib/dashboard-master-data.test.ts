import assert from "node:assert/strict";
import test from "node:test";

import {
  getMasterDataGatedArea,
  getMissingUrgentMasterData,
  getTenantRelativePath,
} from "@/lib/dashboard-master-data";

test("matches only configured academic and registration path boundaries", () => {
  assert.equal(getMasterDataGatedArea("/ulangan"), "Akademik");
  assert.equal(getMasterDataGatedArea("/ulangan/riwayat"), "Akademik");
  assert.equal(getMasterDataGatedArea("/ppdb/settings"), "Pendaftaran");
  assert.equal(getMasterDataGatedArea("/ppdb-lama"), null);
  assert.equal(getMasterDataGatedArea("/dashboard"), null);
});

test("extracts a tenant-relative path from the canonical proxy path", () => {
  assert.equal(getTenantRelativePath("sekolah-a", "/sekolah-a/ulangan/riwayat"), "/ulangan/riwayat");
  assert.equal(getTenantRelativePath("sekolah-a", "/ulangan"), "/ulangan");
  assert.equal(getTenantRelativePath("sekolah-a", "/sekolah-b/ulangan"), "/sekolah-b/ulangan");
});

test("lists missing urgent master data in dependency order", () => {
  const missing = getMissingUrgentMasterData("sekolah-a", {
    academicYears: false,
    students: true,
    teachers: false,
    subjects: false,
    classGroups: true,
  });

  assert.deepEqual(missing, [
    {
      key: "academicYears",
      label: "Tahun Ajaran",
      href: "/sekolah-a/master/tahun-ajaran",
    },
    { key: "teachers", label: "Guru", href: "/sekolah-a/master/guru" },
    {
      key: "subjects",
      label: "Mata Pelajaran",
      href: "/sekolah-a/master/mapel",
    },
  ]);
});

test("returns no warning items when all urgent master data exists", () => {
  const missing = getMissingUrgentMasterData("sekolah-a", {
    academicYears: true,
    students: true,
    teachers: true,
    subjects: true,
    classGroups: true,
  });

  assert.deepEqual(missing, []);
});
