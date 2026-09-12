import assert from "node:assert/strict";
import test from "node:test";

import { NextRequest } from "next/server";

import { POST } from "@/app/api/public-register/route";

test("accepts registration requests on the configured production domain", async () => {
  const previousAppDomain = process.env.APP_DOMAIN;
  process.env.APP_DOMAIN = "simas.biz.id";

  try {
    const response = await POST(new NextRequest("https://simas.biz.id/api/public-register", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        host: "simas.biz.id",
      },
      body: "null",
    }));

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "invalid-input" });
  } finally {
    if (previousAppDomain === undefined) delete process.env.APP_DOMAIN;
    else process.env.APP_DOMAIN = previousAppDomain;
  }
});
