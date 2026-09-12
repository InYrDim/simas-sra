import assert from "node:assert/strict";
import test from "node:test";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { SubjectSubmitButton } from "@/app/(tenant)/[domain]/(authenticated)/master/mapel/subject-submit-button";

test("Mata Pelajaran action uses an explicit submit button", () => {
  const markup = renderToStaticMarkup(
    createElement(
      "form",
      null,
      createElement(SubjectSubmitButton, null, "Simpan Mata Pelajaran"),
    ),
  );

  assert.match(markup, /<button[^>]*type="submit"/);
  assert.match(markup, />Simpan Mata Pelajaran<\/button>/);
});
