import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeMasterDataQuery,
  serializeMasterDataQuery,
} from "@/lib/master-data-workspace";

test("normalizes complete workspace state from the URL", () => {
  assert.deepEqual(normalizeMasterDataQuery({
    q: "  Budi  ",
    status: ["aktif", "lulus"],
    sort: "name-desc",
    page: "3",
    pageSize: "50",
    archive: "archived",
    selected: "student-7",
  }, {
    filters: { status: ["aktif", "lulus", "keluar"] },
    sorts: ["name-asc", "name-desc"],
  }), {
    search: "Budi",
    filters: { status: ["aktif", "lulus"] },
    sort: "name-desc",
    page: 3,
    pageSize: 50,
    archive: "archived",
    selected: "student-7",
  });
});

test("uses safe defaults for malformed URL state", () => {
  assert.deepEqual(normalizeMasterDataQuery({
    status: "unknown",
    sort: "unsafe",
    page: "-2",
    pageSize: "20",
    archive: "deleted",
    selected: " ",
  }, {
    filters: { status: ["aktif"] },
    sorts: ["name-asc"],
  }), {
    search: "",
    filters: {},
    sort: "name-asc",
    page: 1,
    pageSize: 25,
    archive: "active",
    selected: null,
  });
});

test("serializes all state deterministically and resets page when requested", () => {
  const query = normalizeMasterDataQuery({
    q: "Budi",
    status: "aktif",
    page: "4",
    pageSize: "100",
    archive: "all",
    selected: "student-7",
  }, {
    filters: { status: ["aktif"] },
    sorts: ["name-asc"],
  });

  assert.equal(serializeMasterDataQuery(query, { page: 1 }),
    "q=Budi&status=aktif&sort=name-asc&page=1&pageSize=100&archive=all&selected=student-7");
});
