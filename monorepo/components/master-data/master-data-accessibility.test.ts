import assert from "node:assert/strict";
import test from "node:test";


import { JSDOM } from "jsdom";
import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { MasterDataForm } from "@/components/master-data/master-data-form";
import { MasterDataEmpty, MasterDataNotice, MasterDataRegionError } from "@/components/master-data/workspace-states";

test("representative Master Data states have no automated accessibility violations", async () => {
  const content = renderToStaticMarkup(createElement(Fragment, null,
    createElement("main", null,
      createElement("h1", null, "Pola Master Data"),
      createElement(MasterDataEmpty, { filtered: true }),
      createElement(MasterDataRegionError),
      createElement(MasterDataNotice, { kind: "read-only" }),
      createElement(MasterDataNotice, { kind: "archived" }),
      createElement(MasterDataNotice, { kind: "conflict" }),
      createElement(MasterDataForm, { errors: [{ field: "name", message: "Nama wajib diisi" }] },
        createElement("label", { htmlFor: "name" }, "Nama"),
        createElement("input", { id: "name", name: "name", "aria-invalid": "true" }),
      ),
    ),
  ));
  const dom = new JSDOM(`<!doctype html><html lang="id"><head><title>Pola Master Data</title></head><body>${content}</body></html>`);
  Object.assign(globalThis, { window: dom.window, document: dom.window.document });
  const axe = (await import("axe-core")).default;
  const results = await axe.run(dom.window.document.documentElement, { rules: { "color-contrast": { enabled: false } } });
  assert.deepEqual(results.violations.map((violation) => violation.id), []);
});
