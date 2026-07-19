import assert from "node:assert/strict";
import test from "node:test";

import { createPublicRegistration } from "@/lib/public-registration";

test("public registration atomically delegates one credential Pemohon identity without client role or Tenant fields", async () => {
  const writes: unknown[] = [];
  const register = createPublicRegistration({
    createId: (() => { const ids = ["user-1", "account-1"]; return () => ids.shift()!; })(),
    hash: async (password) => `hash:${password}`,
    store: { async createIdentity(values) { writes.push(values); } },
  });
  const result = await register({ name: " Siti  Aminah ", email: " SITI@EXAMPLE.TEST ", password: "secret123", tenantId: "tenant-1", role: "provider-admin" } as never);
  assert.deepEqual(result, { ok: true });
  assert.deepEqual(writes, [{ userId: "user-1", accountId: "account-1", name: "Siti Aminah", email: "siti@example.test", passwordHash: "hash:secret123" }]);
});

test("invalid public registration performs no write", async () => {
  let writes = 0;
  const register = createPublicRegistration({ store: { async createIdentity() { writes += 1; } } });
  assert.deepEqual(await register({ name: "", email: "bad", password: "short" }), { ok: false, code: "invalid-input" });
  assert.equal(writes, 0);
});
