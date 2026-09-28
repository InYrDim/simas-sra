import assert from "node:assert/strict";
import test from "node:test";

import { resolveAuthCookiePolicy } from "@/lib/platform/auth-cookie-policy";

test("development forces plain host-only cookies even when BETTER_AUTH_URL is https", () => {
  const policy = resolveAuthCookiePolicy({ nodeEnv: "development", appDomain: "simas.biz.id" });

  // `__Secure-` prefixes and Domain attributes are silently dropped by browsers
  // on http://<tenant>.localhost origins, which made sessions never persist and
  // protected pages bounce to /login in a loop.
  assert.equal(policy.useSecureCookies, false);
  assert.equal(policy.crossSubDomainCookies.enabled, false);
});

test("production keeps better-auth's own derivation for a multi-label APP_DOMAIN", () => {
  const policy = resolveAuthCookiePolicy({ nodeEnv: "production", appDomain: "simas.biz.id" });

  assert.equal(policy.useSecureCookies, undefined);
  assert.equal(policy.crossSubDomainCookies.enabled, true);
  assert.equal(policy.crossSubDomainCookies.domain, "simas.biz.id");
});

test("single-label APP_DOMAIN never enables cross-subdomain cookies", () => {
  for (const nodeEnv of ["development", "production"]) {
    const policy = resolveAuthCookiePolicy({ nodeEnv, appDomain: "localhost" });

    assert.equal(policy.crossSubDomainCookies.enabled, false);
    assert.equal(policy.crossSubDomainCookies.domain, undefined);
  }
});

test("missing APP_DOMAIN keeps cross-subdomain cookies disabled", () => {
  const policy = resolveAuthCookiePolicy({ nodeEnv: "production", appDomain: undefined });

  assert.equal(policy.crossSubDomainCookies.enabled, false);
  assert.equal(policy.crossSubDomainCookies.domain, undefined);
});

test("ports are stripped from APP_DOMAIN before deriving the cookie domain", () => {
  const policy = resolveAuthCookiePolicy({ nodeEnv: "production", appDomain: "localhost:3000" });

  // Port on a single-label host: no cookie domain (browsers reject TLD domains).
  assert.equal(policy.crossSubDomainCookies.enabled, false);
  assert.equal(policy.crossSubDomainCookies.domain, undefined);

  const multiLabel = resolveAuthCookiePolicy({ nodeEnv: "production", appDomain: "simas.biz.id:443" });
  assert.equal(multiLabel.crossSubDomainCookies.domain, "simas.biz.id");
});
