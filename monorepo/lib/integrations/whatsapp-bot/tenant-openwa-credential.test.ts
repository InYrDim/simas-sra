import assert from "node:assert/strict";
import test from "node:test";

import {
  readOpenWaGlobalBaseUrl,
  readOpenWaWebhookUrl,
} from "@/lib/integrations/whatsapp-bot/openwa-config";
import { resolveTenantOpenWaBaseUrl, normalizeTenantOpenWaCredentialInput } from "@/lib/integrations/whatsapp-bot/tenant-openwa-credential";

function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
  const saved: Record<string, string | undefined> = {};
  for (const key of Object.keys(vars)) saved[key] = process.env[key];
  try {
    for (const [key, value] of Object.entries(vars)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    fn();
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("resolveTenantOpenWaBaseUrl prefers the per-tenant override over the global default", () => {
  assert.deepEqual(resolveTenantOpenWaBaseUrl("https://openwa.tenant-a.example.com/", "https://openwa.example.com"), {
    apiBaseUrl: "https://openwa.tenant-a.example.com",
    usingGlobalDefault: false,
  });
});

test("resolveTenantOpenWaBaseUrl falls back to the global default when no override is set", () => {
  assert.deepEqual(resolveTenantOpenWaBaseUrl(null, "https://openwa.example.com/"), {
    apiBaseUrl: "https://openwa.example.com",
    usingGlobalDefault: true,
  });
});

test("resolveTenantOpenWaBaseUrl yields no base URL when neither override nor global default exists", () => {
  assert.deepEqual(resolveTenantOpenWaBaseUrl(null, null), {
    apiBaseUrl: null,
    usingGlobalDefault: true,
  });
});

test("normalizeTenantOpenWaCredentialInput rejects empty API keys and session keys", () => {
  assert.deepEqual(
    normalizeTenantOpenWaCredentialInput({ apiBaseUrl: null, apiKey: "  ", sessionKey: "s" }),
    { ok: false, reason: "api-key-required" },
  );
  assert.deepEqual(
    normalizeTenantOpenWaCredentialInput({ apiBaseUrl: null, apiKey: "k", sessionKey: "  " }),
    { ok: false, reason: "session-required" },
  );
});

test("normalizeTenantOpenWaCredentialInput trims values and empties out blank base URLs", () => {
  assert.deepEqual(normalizeTenantOpenWaCredentialInput({ apiBaseUrl: "  ", apiKey: " k-1 ", sessionKey: " s " }), {
    ok: true,
    apiBaseUrl: null,
    apiKey: "k-1",
    sessionKey: "s",
  });
  assert.deepEqual(
    normalizeTenantOpenWaCredentialInput({ apiBaseUrl: "https://openwa.school.example.com/", apiKey: "k", sessionKey: "s" }),
    { ok: true, apiBaseUrl: "https://openwa.school.example.com", apiKey: "k", sessionKey: "s" },
  );
});

test("readOpenWaGlobalBaseUrl returns null when OPENWA_API_BASE_URL is absent", () => {
  withEnv({ OPENWA_API_BASE_URL: undefined }, () => {
    assert.equal(readOpenWaGlobalBaseUrl(), null);
  });
  withEnv({ OPENWA_API_BASE_URL: "" }, () => {
    assert.equal(readOpenWaGlobalBaseUrl(), null);
  });
});

test("readOpenWaGlobalBaseUrl normalizes the trailing slashes", () => {
  withEnv({ OPENWA_API_BASE_URL: "https://openwa.example.com///" }, () => {
    assert.equal(readOpenWaGlobalBaseUrl(), "https://openwa.example.com");
  });
});

test("readOpenWaWebhookUrl prefers APP_URL over NEXT_PUBLIC_APP_URL and APP_DOMAIN", () => {
  withEnv(
    {
      APP_URL: "https://app.simas.biz.id/",
      NEXT_PUBLIC_APP_URL: "https://fallback.example.com",
      APP_DOMAIN: "tenant.example.com",
    },
    () => {
      assert.equal(readOpenWaWebhookUrl(), "https://app.simas.biz.id/api/integrations/whatsapp-bot/webhook");
    },
  );

  withEnv(
    {
      APP_URL: undefined,
      NEXT_PUBLIC_APP_URL: "https://fallback.example.com/",
      APP_DOMAIN: "tenant.example.com",
    },
    () => {
      assert.equal(readOpenWaWebhookUrl(), "https://fallback.example.com/api/integrations/whatsapp-bot/webhook");
    },
  );

  withEnv(
    { APP_URL: undefined, NEXT_PUBLIC_APP_URL: undefined, APP_DOMAIN: "tenant.example.com" },
    () => {
      assert.equal(readOpenWaWebhookUrl(), "https://tenant.example.com/api/integrations/whatsapp-bot/webhook");
    },
  );

  withEnv({ APP_URL: undefined, NEXT_PUBLIC_APP_URL: undefined, APP_DOMAIN: undefined }, () => {
    assert.equal(readOpenWaWebhookUrl(), "https://simas.biz.id/api/integrations/whatsapp-bot/webhook");
  });
});