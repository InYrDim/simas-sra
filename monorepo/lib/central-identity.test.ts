import assert from "node:assert/strict";
import test from "node:test";

import { resolveCentralDestination, resolveCentralIdentity, resolvePublicIntent, resolveRawPublicIntent, type CentralIdentitySnapshot } from "@/lib/central-identity";

const base: CentralIdentitySnapshot = { applicant: false, providerAdmin: false, tenantMembership: null, activation: null };
const membership = { tenantId: "tenant-1", domain: "sman-1", role: "school-admin" };

test("identity resolver returns exactly one server-backed identity path", () => {
  assert.deepEqual(resolveCentralIdentity({ ...base, providerAdmin: true }), { kind: "provider-admin", passwordChangeRequired: false });
  assert.deepEqual(resolveCentralIdentity({ ...base, applicant: true }), { kind: "applicant", passwordChangeRequired: false });
  assert.deepEqual(resolveCentralIdentity({ ...base, tenantMembership: membership }), { kind: "tenant-member", tenantId: "tenant-1", domain: "sman-1", passwordChangeRequired: false });
});

test("zero paths, multiple paths, a missing Tenant, and a missing role are invalid", () => {
  assert.deepEqual(resolveCentralIdentity(base), { kind: "invalid", reason: "no-identity-path" });
  assert.deepEqual(resolveCentralIdentity({ ...base, applicant: true, providerAdmin: true }), { kind: "invalid", reason: "multiple-identity-paths" });
  assert.deepEqual(resolveCentralIdentity({ ...base, tenantMembership: { ...membership, domain: null } }), { kind: "invalid", reason: "tenant-missing" });
  assert.deepEqual(resolveCentralIdentity({ ...base, tenantMembership: { ...membership, role: null } }), { kind: "invalid", reason: "tenant-role-missing" });
});

test("destination policy handles every identity and required activation", () => {
  assert.equal(resolveCentralDestination({ kind: "provider-admin" }), "/provider");
  assert.equal(resolveCentralDestination({ kind: "applicant" }), "/apply");
  assert.equal(resolveCentralDestination({ kind: "tenant-member", ...membership, passwordChangeRequired: false }), "/sman-1/dashboard");
  for (const identity of [
    { kind: "provider-admin", passwordChangeRequired: true },
    { kind: "applicant", passwordChangeRequired: true },
    { kind: "tenant-member", tenantId: "tenant-1", domain: "sman-1", passwordChangeRequired: true }
  ] as const) assert.equal(resolveCentralDestination(identity), "/change-password");
  assert.equal(resolveCentralDestination({ kind: "invalid", reason: "no-identity-path" }), "/access-error");
});

test("only the literal apply intent is accepted and rejected values are logged", () => {
  const logs: unknown[] = [];
  const log = (event: { event: "central_auth_intent_rejected"; value: string }) => logs.push(event);
  assert.equal(resolvePublicIntent("apply", log), "apply");
  for (const value of ["/apply", "unknown", "%61pply", "https://evil.test", "apply?next=/provider"]) assert.equal(resolvePublicIntent(value, log), null);
  assert.equal(resolveRawPublicIntent("?intent=apply", log), "apply");
  assert.equal(resolveRawPublicIntent("?intent=%61pply", log), null);
  assert.equal(logs.length, 6);
});

test("server identity destination always wins over public intent", () => {
  assert.equal(resolvePublicIntent("apply"), "apply");
  assert.equal(resolveCentralDestination(resolveCentralIdentity({ ...base, providerAdmin: true })), "/provider");
});
