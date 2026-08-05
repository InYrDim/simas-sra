import assert from "node:assert/strict";
import test from "node:test";

import { getTenantSubdomain, isProtectedTenantPage, resolveProxyRoute } from "@/lib/platform/proxy-routing";

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

test("redirects path-based Tenant URLs on the main host to the Tenant subdomain", () => {
  assert.deepEqual(resolveProxyRoute("localhost:3000", "/sekolah/dashboard"), {
    kind: "redirect",
    hostname: "sekolah.localhost",
    pathname: "/dashboard",
  });
  assert.deepEqual(resolveProxyRoute("localhost:3000", "/sekolah/dashboard", "simas.biz.id"), {
    kind: "redirect",
    hostname: "sekolah.localhost",
    pathname: "/dashboard",
  });
  assert.deepEqual(resolveProxyRoute("simas.biz.id", "/sekolah/master", "simas.biz.id"), {
    kind: "redirect",
    hostname: "sekolah.simas.biz.id",
    pathname: "/master",
  });
});

test("keeps central application paths on the main host", () => {
  for (const pathname of ["/", "/login", "/change-password", "/apply", "/provider/tenants"]) {
    assert.deepEqual(resolveProxyRoute("localhost:3000", pathname), { kind: "next" });
  }
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

test("rejects legacy non-session PPDB public routes", () => {
  assert.deepEqual(resolveProxyRoute("sekolah.localhost:3000", "/ppdb/daftar"), { kind: "not-found" });
  assert.deepEqual(resolveProxyRoute("sekolah.localhost:3000", "/ppdb/daftar/status"), { kind: "not-found" });
});

test("rewrites session-scoped Tenant PPDB public routes", () => {
  assert.deepEqual(resolveProxyRoute("sekolah.localhost:3000", "/ppdb/session-1/daftar"), {
    kind: "rewrite",
    pathname: "/ppdb/sekolah/session-1/daftar",
  });
  assert.deepEqual(resolveProxyRoute("sekolah.simas.test", "/ppdb/session-1/status"), {
    kind: "rewrite",
    pathname: "/ppdb/sekolah/session-1/status",
  });
});

test("redirects internal session-scoped PPDB paths to the public route", () => {
  assert.deepEqual(resolveProxyRoute("sekolah.localhost:3000", "/ppdb/sekolah/session-1/daftar"), {
    kind: "redirect",
    hostname: "sekolah.localhost",
    pathname: "/ppdb/session-1/daftar",
  });
  assert.deepEqual(resolveProxyRoute("sekolah.simas.test", "/ppdb/sekolah/session-1/status"), {
    kind: "redirect",
    hostname: "sekolah.simas.test",
    pathname: "/ppdb/session-1/status",
  });
});

test("routes Tenant PPDB administration at the PPDB namespace", () => {
  assert.deepEqual(resolveProxyRoute("sekolah.localhost:3000", "/ppdb"), {
    kind: "rewrite",
    pathname: "/sekolah/ppdb",
  });
  assert.deepEqual(resolveProxyRoute("sekolah.localhost:3000", "/ppdb/settings"), {
    kind: "rewrite",
    pathname: "/sekolah/ppdb/settings",
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

test("removes leaked internal Tenant prefixes from public subdomain URLs", () => {
  assert.deepEqual(resolveProxyRoute("sekolah.localhost:3000", "/sekolah/dashboard"), {
    kind: "redirect",
    hostname: "sekolah.localhost",
    pathname: "/dashboard",
  });
  assert.deepEqual(resolveProxyRoute("sekolah.localhost:3000", "/sekolah"), {
    kind: "redirect",
    hostname: "sekolah.localhost",
    pathname: "/",
  });
  assert.deepEqual(resolveProxyRoute("sekolah.localhost:3000", "/sekolah/ppdb/riwayat"), {
    kind: "redirect",
    hostname: "sekolah.localhost",
    pathname: "/ppdb/riwayat",
  });
});

test("does not treat similarly-prefixed paths as Provider routes", () => {
  assert.deepEqual(resolveProxyRoute("sekolah.simas.test", "/providership"), {
    kind: "rewrite",
    pathname: "/sekolah/providership",
  });
});

test("isProtectedTenantPage gates the authenticated route group only", () => {
  assert.equal(isProtectedTenantPage("/sekolah/dashboard", "sekolah"), true);
  assert.equal(isProtectedTenantPage("/sekolah/master/mapel", "sekolah"), true);
  assert.equal(isProtectedTenantPage("/sekolah/ppdb", "sekolah"), true);
  assert.equal(isProtectedTenantPage("/sekolah/ppdb/settings", "sekolah"), true);
  assert.equal(isProtectedTenantPage("/sekolah/users", "sekolah"), true);
});

test("isProtectedTenantPage keeps public Tenant pages reachable without a session", () => {
  assert.equal(isProtectedTenantPage("/sekolah", "sekolah"), false);
  assert.equal(isProtectedTenantPage("/sekolah/", "sekolah"), false);
  assert.equal(isProtectedTenantPage("/sekolah/login", "sekolah"), false);
  assert.equal(isProtectedTenantPage("/sekolah/continue", "sekolah"), false);
  assert.equal(isProtectedTenantPage("/sekolah/account-lifecycle/case-123", "sekolah"), false);
});

test("isProtectedTenantPage ignores non-Tenant rewrites and other domains", () => {
  assert.equal(isProtectedTenantPage("/ppdb/sekolah/session-1/daftar", "sekolah"), false);
  assert.equal(isProtectedTenantPage("/other/dashboard", "sekolah"), false);
  assert.equal(isProtectedTenantPage("/", "sekolah"), false);
});

test("getTenantSubdomain resolves dev and production tenant hosts", () => {
  assert.equal(getTenantSubdomain("sekolah.localhost:3100"), "sekolah");
  assert.equal(getTenantSubdomain("sekolah.simas.test", "simas.test"), "sekolah");
  assert.equal(getTenantSubdomain("localhost:3100"), null);
  assert.equal(getTenantSubdomain("simas.test", "simas.test"), null);
  assert.equal(getTenantSubdomain("www.simas.test", "simas.test"), null);
});
