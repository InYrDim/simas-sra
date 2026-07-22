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

test("central auth rejects and logs encoded intent at the route boundary", () => {
  const events: unknown[] = [];
  const originalWarn = console.warn;
  console.warn = (event) => events.push(event);
  try {
    const response = proxy(request("localhost:3000", "/login?intent=%61pply"));
    assert.equal(response.status, 200);
    assert.deepEqual(events, [{ event: "central_auth_intent_rejected", value: "%61pply" }]);
  } finally {
    console.warn = originalWarn;
  }
});

test("rewrites the Tenant PPDB vanity route to the public application", () => {
  const response = proxy(request("sekolah.localhost:3000", "/ppdb"));

  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get("x-middleware-rewrite"),
    "http://sekolah.localhost:3000/ppdb/sekolah",
  );
});

test("passes the matching public PPDB route through on Tenant hosts", () => {
  const response = proxy(request("sekolah.localhost:3000", "/ppdb/sekolah"));

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-middleware-next"), "1");
  assert.equal(response.headers.get("x-middleware-rewrite"), null);
});

test("rewrites ordinary Tenant routes and forwards the canonical path to guards", () => {
  const response = proxy(request("sekolah.localhost:3000", "/dashboard"));

  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get("x-middleware-rewrite"),
    "http://sekolah.localhost:3000/sekolah/dashboard",
  );
  assert.equal(response.headers.get("x-middleware-request-x-tenant-pathname"), "/sekolah/dashboard");
});

test("rewrites Tenant login without treating the requested domain as membership", () => {
  const response = proxy(request("sekolah.localhost:3000", "/login"));
  assert.equal(response.headers.get("x-middleware-rewrite"), "http://sekolah.localhost:3000/sekolah/login");
});
