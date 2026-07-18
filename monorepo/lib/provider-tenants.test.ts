import assert from "node:assert/strict";
import test from "node:test";

import { literalLikePattern, normalizeTenantListQuery } from "@/lib/provider-tenants";

test("tenant search treats SQL wildcard characters literally", () => {
  assert.equal(literalLikePattern("100%_==school"), "%100=%=_====school%");
});

test("tenant list query normalizes supported filters, sorting, and pagination", () => {
  assert.deepEqual(
    normalizeTenantListQuery({
      page: "3",
      search: "  SMAN 1  ",
      sort: "school-desc",
      stage: "ending-soon",
    }),
    {
      page: 3,
      search: "SMAN 1",
      sort: "school-desc",
      stage: "ending-soon",
    },
  );

  assert.deepEqual(
    normalizeTenantListQuery({ page: "0", search: "   ", sort: "unknown", stage: "unknown" }),
    { page: 1, search: undefined, sort: "newest", stage: "all" },
  );
});
