import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { MasterDataWorkspace } from "@/components/master-data/master-data-workspace";

test("critical Mata Pelajaran workspace exposes URL controls, archived status, and mobile detail return", () => {
  const html = renderToStaticMarkup(createElement(MasterDataWorkspace, {
    title: "Mata Pelajaran",
    description: "Katalog Tenant",
    basePath: "/sekolah/master/mapel",
    query: { search: "mat", filters: { level: ["SMA"] }, sort: "code-asc", page: 1, pageSize: 25, archive: "all", selected: "subject-1" },
    items: [{ id: "subject-1", title: "Matematika", description: "MAT-01 · SMA", lifecycle: "Tersedia", archived: true }],
    total: 1,
    filters: [{ name: "level", label: "Jenjang", options: [{ value: "SMA", label: "SMA" }] }],
    sortOptions: [{ value: "code-asc", label: "Kode A–Z" }],
    detail: createElement("p", null, "Detail hanya-baca"),
  }));
  assert.match(html, /role="search"/);
  assert.match(html, /name="level"/);
  assert.match(html, /value="code-asc" selected/);
  assert.match(html, /Arsip:<\/span> Diarsipkan/);
  assert.match(html, /Kembali ke daftar/);
  assert.match(html, /selected=subject-1/);
});
