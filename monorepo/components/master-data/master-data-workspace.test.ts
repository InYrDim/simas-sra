import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { MasterDataWorkspace } from "@/components/master-data/master-data-workspace";

test("renders an explicit submit control for Master Data filters", () => {
  const markup = renderToStaticMarkup(
    createElement(MasterDataWorkspace, {
      title: "Guru",
      description: "Master Data Guru",
      basePath: "/sekolah/master/guru",
      query: {
        search: "",
        filters: {},
        sort: "name-asc",
        page: 1,
        pageSize: 25,
        archive: "active",
        selected: null,
      },
      items: [],
      total: 0,
      filters: [
        {
          name: "status",
          label: "Status Guru",
          options: [{ value: "active", label: "Aktif" }],
        },
      ],
    }),
  );

  assert.match(markup, /<button[^>]*type="submit"[^>]*>Terapkan filter<\/button>/);
});

test("renders Master Data records in a classic table", () => {
  const markup = renderToStaticMarkup(
    createElement(MasterDataWorkspace, {
      title: "Guru",
      description: "Master Data Guru",
      basePath: "/sekolah/master/guru",
      query: {
        search: "",
        filters: {},
        sort: "name-asc",
        page: 1,
        pageSize: 25,
        archive: "active",
        selected: null,
      },
      items: [
        {
          id: "teacher-1",
          title: "Siti Aminah",
          description: "Nomor internal Guru 001",
          lifecycle: "Aktif",
          archived: false,
        },
      ],
      total: 1,
    }),
  );

  assert.match(markup, /<table/);
  assert.match(markup, /<th[^>]*>Nama<\/th>/);
  assert.match(markup, /<th[^>]*>Keterangan<\/th>/);
  assert.match(markup, /<th[^>]*>Status<\/th>/);
  assert.match(markup, /<th[^>]*>Arsip<\/th>/);
  assert.match(markup, /<td[^>]*>Siti Aminah<\/td>/);
  assert.match(markup, />Detail<\/a>/);
});
