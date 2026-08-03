import assert from "node:assert/strict";
import test from "node:test";

import { createInternalLifecycleDelivery, deriveInternalEmailSecret } from "@/lib/tenancy/tenant-account-lifecycle-delivery";

test("internal lifecycle delivery contains a case reference but never a secret", () => {
  process.env.APP_URL = "http://localhost:3000";
  const delivery = createInternalLifecycleDelivery({ domain: "school.example", caseId: "case-1", tenantId: "tenant-1", userId: "user-1", kind: "activation", recipient: "user@example.test", secret: "secret", expiresAt: new Date("2026-08-03T00:00:00.000Z") });
  assert.equal(delivery.activationUrl, "http://localhost:3000/school.example/account-lifecycle/case-1");
  assert.equal(delivery.activationUrl.includes(delivery.secret), false);
});

test("email secret derivation is stable for the same lifecycle case", () => {
  const input = { key: "x".repeat(32), caseId: "case-1", kind: "recovery" as const, tenantId: "tenant-1", userId: "user-1", expiresAt: new Date("2026-08-03T00:00:00.000Z") };
  assert.equal(deriveInternalEmailSecret(input), deriveInternalEmailSecret(input));
  assert.notEqual(deriveInternalEmailSecret(input), deriveInternalEmailSecret({ ...input, caseId: "case-2" }));
});
