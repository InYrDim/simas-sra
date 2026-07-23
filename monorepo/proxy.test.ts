import assert from "node:assert/strict";
import test from "node:test";

import { NextRequest } from "next/server";

import { proxy } from "@/proxy";

function request(host: string, pathname: string) {
  return new NextRequest(`http://${host}${pathname}`, {
    headers: { host },
  });
}

function forwardedRequest(host: string, pathname: string) {
  return new NextRequest(`http://app:3000${pathname}`, {
    headers: {
      host,
      "x-forwarded-host": host,
      "x-forwarded-proto": "https",
    },
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

test("rewrites the Tenant PPDB public vanity route to the public application", () => {
  const response = proxy(request("sekolah.localhost:3000", "/ppdb/daftar"));

  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get("x-middleware-rewrite"),
    "http://sekolah.localhost:3000/ppdb/sekolah",
  );
});

test("redirects internal public PPDB paths to the public vanity route", () => {
  const response = proxy(request("sekolah.localhost:3000", "/ppdb/sekolah"));

  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), "http://sekolah.localhost:3000/ppdb/daftar");
});

test("keeps PPDB administration separate from the public PPDB page", () => {
  const response = proxy(request("sekolah.localhost:3000", "/ppdb/settings"));

  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get("x-middleware-rewrite"),
    "http://sekolah.localhost:3000/sekolah/ppdb/settings",
  );
  assert.equal(
    response.headers.get("x-middleware-request-x-tenant-pathname"),
    "/sekolah/ppdb/settings",
  );
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

test("keeps rewrites internal while forwarding the canonical public origin", () => {
  const host = "uptd-sdn-191-inpres-batunapara.simas.biz.id";
  const response = proxy(forwardedRequest(host, "/dashboard"));

  assert.equal(
    response.headers.get("x-middleware-rewrite"),
    "http://app:3000/uptd-sdn-191-inpres-batunapara/dashboard",
  );
  assert.equal(response.headers.get("x-middleware-request-host"), host);
  assert.equal(response.headers.get("x-middleware-request-x-forwarded-host"), host);
  assert.equal(response.headers.get("x-middleware-request-x-forwarded-proto"), "https");
  assert.equal(response.headers.get("x-middleware-request-x-forwarded-port"), "443");
});

test("rewrites Tenant login without treating the requested domain as membership", () => {
  const response = proxy(request("sekolah.localhost:3000", "/login"));
  assert.equal(response.headers.get("x-middleware-rewrite"), "http://sekolah.localhost:3000/sekolah/login");
});
