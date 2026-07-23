import assert from "node:assert/strict";
import test from "node:test";

import {
  mergeTenantLandingPageSettings,
  readTenantLandingPageSettings,
  renderTenantLandingPage,
} from "@/lib/tenant-landing-page";

test("landing page settings preserve unrelated Tenant settings", () => {
  const settings = mergeTenantLandingPageSettings(
    { features: { advancedAnalytics: true }, landingPage: { theme: "blue" } },
    "<h1>Halo</h1>",
  );

  assert.deepEqual(settings, {
    features: { advancedAnalytics: true },
    landingPage: { theme: "blue", html: "<h1>Halo</h1>" },
  });
  assert.deepEqual(readTenantLandingPageSettings(settings), { html: "<h1>Halo</h1>" });
});

test("landing page renderer replaces escaped placeholders and targets the parent page", () => {
  const html = renderTenantLandingPage({
    html: "<html><head><title>{{TENANT_NAME}}</title></head><body><a href=\"{{LOGIN_URL}}\">Login</a><a href=\"{{PPDB_URL}}\">PPDB</a></body></html>",
    tenantName: "Sekolah <Utama>",
    loginUrl: "/sekolah/login?next=1&source=landing",
    ppdbUrl: "/ppdb/sekolah",
  });

  assert.match(html, /<head><base target="_top">/);
  assert.match(html, /Sekolah &lt;Utama&gt;/);
  assert.match(html, /href="\/sekolah\/login\?next=1&amp;source=landing"/);
  assert.match(html, /href="\/ppdb\/sekolah"/);
  assert.match(html, /<footer data-simas-attribution/);
  assert.match(html, /Didukung oleh <strong[^>]*>SIMAS<\/strong> — Sistem Manajemen Sekolah/);
  assert.match(html, /href="https:\/\/simas\.biz\.id"/);
  assert.ok(html.indexOf("data-simas-attribution") < html.indexOf("</body>"));
});

test("empty custom HTML uses the built-in landing page", () => {
  const html = renderTenantLandingPage({
    html: "  ",
    tenantName: "Sekolah Contoh",
    loginUrl: "/contoh/login",
    ppdbUrl: "/ppdb/contoh",
  });

  assert.match(html, /Sekolah Contoh/);
  assert.match(html, /href="\/contoh\/login"/);
  assert.match(html, /href="\/ppdb\/contoh"/);
});
