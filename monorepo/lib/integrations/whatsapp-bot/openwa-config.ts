export type OpenWaConnectionConfig = {
  apiBaseUrl: string;
  apiKey: string;
};

/**
 * Reads the Provider-level default OpenWA server URL. The per-tenant override
 * from tenant_openwa_credential takes precedence when present; this value is
 * only the fallback for tenants without an override.
 */
export function readOpenWaGlobalBaseUrl(): string | null {
  const apiBaseUrl = process.env.OPENWA_API_BASE_URL;
  if (!apiBaseUrl) return null;
  return apiBaseUrl.replace(/\/+$/, "");
}

export function readOpenWaAdminApiKey(): string | null {
  const apiKey = process.env.OPENWA_ADMIN_API_KEY;
  return apiKey?.trim() || null;
}

export function readOpenWaWebhookUrl(): string {
  const base =
    process.env.APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    `https://${process.env.APP_DOMAIN ?? "simas.biz.id"}`;
  return `${base.replace(/\/+$/, "")}/api/integrations/whatsapp-bot/webhook`;
}