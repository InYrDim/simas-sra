import assert from "node:assert/strict";
import test from "node:test";

import { NextRequest } from "next/server";

import { proxy } from "@/proxy";

function request(host: string, pathname: string) {
  return new NextRequest(`http://${host}${pathname}`, {
    headers: { host },
  });
}

test("passes Provider routes through on the main host", () => {
  const response = proxy(request("localhost:3000", "/provider/tenants"));

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-middleware-next"), "1");
  assert.equal(response.headers.get("x-middleware-rewrite"), null);
});

test("returns 404 for Provider routes on Tenant hosts", () => {
  const response = proxy(request("sekolah.localhost:3000", "/provider"));

  assert.equal(response.status, 404);
  assert.equal(response.headers.get("x-middleware-rewrite"), null);
});

test("rewrites ordinary Tenant routes", () => {
  const response = proxy(request("sekolah.localhost:3000", "/dashboard"));

  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get("x-middleware-rewrite"),
    "http://sekolah.localhost:3000/sekolah/dashboard",
  );
});
