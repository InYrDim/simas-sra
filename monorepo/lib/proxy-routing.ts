export const TENANT_PATHNAME_HEADER = "x-tenant-pathname";

export type ProxyRoute =
  | { kind: "next" }
  | { kind: "not-found" }
  | { kind: "rewrite"; pathname: string };

function getTenantSubdomain(host: string) {
  const hostname = host.split(":", 1)[0].toLowerCase();

  if (hostname === "localhost" || hostname === "www.localhost") return null;

  if (hostname.endsWith(".localhost")) {
    return hostname.slice(0, -".localhost".length).split(".")[0] || null;
  }

  const parts = hostname.split(".");
  if (parts.length < 3 || parts[0] === "www") return null;

  return parts[0];
}

function isProviderPath(pathname: string) {
  return pathname === "/provider" || pathname.startsWith("/provider/");
}

export function resolveProxyRoute(host: string, pathname: string): ProxyRoute {
  const subdomain = getTenantSubdomain(host);

  if (!subdomain) return { kind: "next" };
  if (isProviderPath(pathname)) return { kind: "not-found" };

  const tenantPrefix = `/${subdomain}`;
  if (pathname === tenantPrefix || pathname.startsWith(`${tenantPrefix}/`)) {
    return { kind: "rewrite", pathname };
  }
  return { kind: "rewrite", pathname: `${tenantPrefix}${pathname}` };
}
