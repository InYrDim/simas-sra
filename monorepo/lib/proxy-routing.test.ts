import assert from "node:assert/strict";
import test from "node:test";

import { resolveProxyRoute } from "@/lib/proxy-routing";

test("passes the configured production domain through as the main host", () => {
  assert.deepEqual(resolveProxyRoute("simas.biz.id", "/", "simas.biz.id"), {
    kind: "next",
  });
  assert.deepEqual(resolveProxyRoute("www.simas.biz.id", "/provider", "simas.biz.id"), {
    kind: "next",
  });
});

test("routes subdomains beneath the configured production domain as Tenants", () => {
  assert.deepEqual(resolveProxyRoute("sekolah.simas.biz.id", "/dashboard", "simas.biz.id"), {
    kind: "rewrite",
    pathname: "/sekolah/dashboard",
  });
});

test("passes canonical Provider routes through on the main host", () => {
  assert.deepEqual(resolveProxyRoute("localhost:3000", "/provider"), {
    kind: "next",
  });
  assert.deepEqual(resolveProxyRoute("www.simas.test", "/provider/tenants"), {
    kind: "next",
  });
});

test("returns not found for Provider routes on Tenant hosts", () => {
  assert.deepEqual(resolveProxyRoute("sekolah.localhost:3000", "/provider"), {
    kind: "not-found",
  });
  assert.deepEqual(
    resolveProxyRoute("sekolah.simas.test", "/provider/tenants/tenant-1"),
    { kind: "not-found" },
  );
});

test("rewrites the Tenant PPDB vanity route to the public application", () => {
  assert.deepEqual(resolveProxyRoute("sekolah.localhost:3000", "/ppdb"), {
    kind: "rewrite",
    pathname: "/ppdb/sekolah",
  });
  assert.deepEqual(resolveProxyRoute("sekolah.simas.test", "/ppdb/status"), {
    kind: "rewrite",
    pathname: "/ppdb/sekolah/status",
  });
});

test("passes the matching public PPDB route through on Tenant hosts", () => {
  assert.deepEqual(resolveProxyRoute("sekolah.localhost:3000", "/ppdb/sekolah"), {
    kind: "next",
  });
  assert.deepEqual(resolveProxyRoute("sekolah.simas.test", "/ppdb/sekolah/status"), {
    kind: "next",
  });
});

test("continues rewriting ordinary Tenant routes", () => {
  assert.deepEqual(resolveProxyRoute("sekolah.localhost:3000", "/dashboard"), {
    kind: "rewrite",
    pathname: "/sekolah/dashboard",
  });
  assert.deepEqual(resolveProxyRoute("sekolah.simas.test", "/settings"), {
    kind: "rewrite",
    pathname: "/sekolah/settings",
  });
});

test("does not duplicate an exact Tenant prefix on redirected internal paths", () => {
  assert.deepEqual(resolveProxyRoute("sekolah.localhost:3000", "/sekolah/dashboard"), {
    kind: "rewrite",
    pathname: "/sekolah/dashboard",
  });
  assert.deepEqual(resolveProxyRoute("sekolah.localhost:3000", "/sekolah-lain/dashboard"), {
    kind: "rewrite",
    pathname: "/sekolah/sekolah-lain/dashboard",
  });
});

test("does not treat similarly-prefixed paths as Provider routes", () => {
  assert.deepEqual(resolveProxyRoute("sekolah.simas.test", "/providership"), {
    kind: "rewrite",
    pathname: "/sekolah/providership",
  });
});
