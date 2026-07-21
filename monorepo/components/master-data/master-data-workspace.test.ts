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
