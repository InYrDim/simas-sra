import assert from "node:assert/strict";
import test from "node:test";

import { resolveProxyRoute } from "@/lib/proxy-routing";

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

test("does not treat similarly-prefixed paths as Provider routes", () => {
  assert.deepEqual(resolveProxyRoute("sekolah.simas.test", "/providership"), {
    kind: "rewrite",
    pathname: "/sekolah/providership",
  });
});
