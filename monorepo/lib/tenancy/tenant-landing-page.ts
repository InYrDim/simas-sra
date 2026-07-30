export const MAX_TENANT_LANDING_PAGE_HTML_LENGTH = 100_000;

const DEFAULT_LANDING_PAGE_HTML = `<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Portal Sekolah</title>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; font-family: system-ui, sans-serif; color: #0f172a; background: #f8fafc; }
      main { width: min(100%, 640px); padding: 48px; text-align: center; background: white; border: 1px solid #e2e8f0; border-radius: 24px; box-shadow: 0 20px 50px rgba(15, 23, 42, .08); }
      h1 { margin: 0 0 12px; font-size: clamp(2rem, 7vw, 3.5rem); }
      p { margin: 0 0 32px; color: #475569; }
      nav { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; }
      a { padding: 12px 20px; color: white; background: #0369a1; border-radius: 10px; text-decoration: none; font-weight: 600; }
      a.secondary { color: #0369a1; background: #e0f2fe; }
    </style>
  </head>
  <body>
    <main>
      <h1>{{TENANT_NAME}}</h1>
      <p>Selamat datang di portal sekolah.</p>
      <nav>
        <a href="{{LOGIN_URL}}">Masuk ke SIMAS</a>
        <a class="secondary" href="{{PPDB_URL}}">Pendaftaran PPDB</a>
      </nav>
    </main>
  </body>
</html>`;

type LandingPageSettings = Readonly<{ html: string }>;

export function readTenantLandingPageSettings(settings: unknown): LandingPageSettings {
  if (!settings || typeof settings !== "object") return { html: "" };
  const landingPage = (settings as Record<string, unknown>).landingPage;
  if (!landingPage || typeof landingPage !== "object") return { html: "" };
  const html = (landingPage as Record<string, unknown>).html;
  return { html: typeof html === "string" ? html : "" };
}

export function mergeTenantLandingPageSettings(settings: unknown, html: string): Record<string, unknown> {
  const root = settings && typeof settings === "object"
    ? { ...settings as Record<string, unknown> }
    : {};
  const landingPage = root.landingPage && typeof root.landingPage === "object"
    ? root.landingPage as Record<string, unknown>
    : {};

  return { ...root, landingPage: { ...landingPage, html } };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderTenantLandingPage(input: {
  html: string;
  tenantName: string;
  loginUrl: string;
  ppdbUrl: string;
}) {
  const template = input.html.trim() || DEFAULT_LANDING_PAGE_HTML;
  const rendered = template
    .replaceAll("{{TENANT_NAME}}", escapeHtml(input.tenantName))
    .replaceAll("{{LOGIN_URL}}", escapeHtml(input.loginUrl))
    .replaceAll("{{PPDB_URL}}", escapeHtml(input.ppdbUrl));
  const base = '<base target="_top">';
  const withBase = /<head(?:\s[^>]*)?>/i.test(rendered)
    ? rendered.replace(/<head(?:\s[^>]*)?>/i, (head) => `${head}${base}`)
    : `${base}${rendered}`;
  const attribution = `<footer data-simas-attribution style="box-sizing:border-box!important;width:100%!important;margin:0!important;padding:12px 16px!important;text-align:center!important;color:#cbd5e1!important;background:#020617!important;border-top:1px solid #334155!important;font:500 12px/1.5 ui-sans-serif,system-ui,sans-serif!important"><a href="https://simas.biz.id" target="_blank" rel="noopener noreferrer" style="color:#e2e8f0!important;text-decoration:none!important">Didukung oleh <strong style="color:#fff!important">SIMAS</strong> — Sistem Manajemen Sekolah</a></footer>`;

  return /<\/body\s*>/i.test(withBase)
    ? withBase.replace(/<\/body\s*>/i, `${attribution}</body>`)
    : `${withBase}${attribution}`;
}
