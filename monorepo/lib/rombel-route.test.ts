import assert from "node:assert/strict";
import test from "node:test";

import { rombelResultPath } from "@/lib/rombel-route";

test("keeps the selected Rombel visible after a relationship change", () => {
  assert.equal(
    rombelResultPath("sekolah", { ok: true }, "rombel-1"),
    "/sekolah/master/rombel?result=saved&selected=rombel-1",
  );
});

test("builds a result path without selection after creating a Rombel", () => {
  assert.equal(
    rombelResultPath("sekolah", { ok: false, code: "invalid-input" }),
    "/sekolah/master/rombel?result=invalid-input",
  );
});
