import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveTenantLogin,
  resolveTenantPageAccess,
  sanitizeTenantContinuation,
  type TenantLoginStore,
} from "@/lib/tenant-login";

const requestedTenant = { id: "tenant-1", domain: "sekolah", name: "SDN Sekolah" };

function store(tenant = requestedTenant): TenantLoginStore {
  return { findByExactDomain: async (domain) => domain === tenant.domain ? tenant : null };
}

test("Tenant login resolves the requested domain exactly before showing credentials", async () => {
  assert.deepEqual(await resolveTenantLogin(store(), "sekolah", null), {
    kind: "login-required",
    tenant: requestedTenant,
    continuation: null,
  });
  assert.deepEqual(await resolveTenantLogin(store(), "Sekolah", null), {
    kind: "tenant-not-found",
  });
  assert.deepEqual(await resolveTenantLogin(store(), "nama-sekolah", null), {
    kind: "tenant-not-found",
  });
});

test("authenticated identities are routed by server identity rather than requested domain", async () => {
  assert.deepEqual(await resolveTenantLogin(store(), "sekolah", { kind: "tenant-member", tenantId: "tenant-1", domain: "sekolah", passwordChangeRequired: false, promotedApplicant: true }), {
    kind: "redirect", destination: "/sekolah/dashboard",
  });
  assert.deepEqual(await resolveTenantLogin(store(), "sekolah", { kind: "tenant-member", tenantId: "tenant-2", domain: "lain", passwordChangeRequired: false, promotedApplicant: false }), {
    kind: "redirect", destination: "/lain/dashboard",
  });
  assert.deepEqual(await resolveTenantLogin(store(), "sekolah", { kind: "applicant" }), { kind: "redirect", destination: "/apply" });
  assert.deepEqual(await resolveTenantLogin(store(), "sekolah", { kind: "provider-admin" }), { kind: "redirect", destination: "/provider" });
  assert.deepEqual(await resolveTenantLogin(store(), "sekolah", { kind: "invalid", reason: "no-identity-path" }), { kind: "redirect", destination: "/access-error" });
});

test("Tenant page guard distinguishes anonymous, authorized, and authenticated unauthorized users", async () => {
  assert.deepEqual(await resolveTenantPageAccess(store(), "sekolah", null, "/sekolah/settings"), {
    kind: "login-required", destination: "/sekolah/login?continuation=%2Fsekolah%2Fsettings",
  });
  assert.deepEqual(await resolveTenantPageAccess(store(), "sekolah", { kind: "tenant-member", tenantId: "tenant-1", domain: "sekolah", passwordChangeRequired: false, promotedApplicant: false }), {
    kind: "authorized", tenant: requestedTenant,
  });
  assert.deepEqual(await resolveTenantPageAccess(store(), "sekolah", { kind: "tenant-member", tenantId: "tenant-2", domain: "lain", passwordChangeRequired: false, promotedApplicant: false }), {
    kind: "redirect", destination: "/lain/dashboard",
  });
  assert.deepEqual(await resolveTenantPageAccess(store(), "missing", null), { kind: "tenant-not-found" });
});

test("own-Tenant members may continue only to a canonical path inside the exact Tenant prefix", async () => {
  assert.deepEqual(await resolveTenantLogin(store(), "sekolah", { kind: "tenant-member", tenantId: "tenant-1", domain: "sekolah", passwordChangeRequired: false, promotedApplicant: false }, "/sekolah/settings"), {
    kind: "redirect", destination: "/sekolah/settings",
  });
});

test("continuation rejects the open-redirect and cross-portal corpus", () => {
  for (const value of [
    "https://evil.test", "//evil.test/path", "%2F%2Fevil.test", "/%2f%2fevil.test",
    "/sekolah-evil/dashboard", "/lain/dashboard", "/apply", "/provider", "/provider/tenants",
    "/sekolah/../provider", "/sekolah/%2e%2e/provider", "\\evil.test", " /sekolah/dashboard",
    "/sekolah%2Fdashboard", "/sekolah//dashboard",
  ]) assert.equal(sanitizeTenantContinuation(value, "sekolah"), null, value);

  assert.equal(sanitizeTenantContinuation("/sekolah", "sekolah"), "/sekolah");
  assert.equal(sanitizeTenantContinuation("/sekolah/dashboard?tab=profil", "sekolah"), "/sekolah/dashboard?tab=profil");
});
