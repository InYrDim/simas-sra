export const TENANT_PATHNAME_HEADER = "x-tenant-pathname";

export type ProxyRoute =
  | { kind: "next" }
  | { kind: "not-found" }
  | { kind: "rewrite"; pathname: string };

function getTenantSubdomain(host: string, appDomain?: string) {
  const hostname = host.split(":", 1)[0].toLowerCase();
  const configuredDomain = appDomain?.split(":", 1)[0].toLowerCase().replace(/^\.+|\.+$/g, "");

  if (configuredDomain) {
    if (hostname === configuredDomain || hostname === `www.${configuredDomain}`) return null;

    const suffix = `.${configuredDomain}`;
    if (hostname.endsWith(suffix)) {
      const subdomain = hostname.slice(0, -suffix.length);
      return subdomain && !subdomain.includes(".") ? subdomain : null;
    }
  }

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

export function resolveProxyRoute(host: string, pathname: string, appDomain?: string): ProxyRoute {
  const subdomain = getTenantSubdomain(host, appDomain);

  if (!subdomain) return { kind: "next" };
  if (isProviderPath(pathname)) return { kind: "not-found" };

  const publicPpdbPrefix = `/ppdb/${subdomain}`;
  if (pathname === publicPpdbPrefix || pathname.startsWith(`${publicPpdbPrefix}/`)) {
    return { kind: "next" };
  }
  if (pathname === "/ppdb" || pathname === "/ppdb/status") {
    return {
      kind: "rewrite",
      pathname: `${publicPpdbPrefix}${pathname.slice("/ppdb".length)}`,
    };
  }

  const tenantPrefix = `/${subdomain}`;
  if (pathname === tenantPrefix || pathname.startsWith(`${tenantPrefix}/`)) {
    return { kind: "rewrite", pathname };
  }
  return { kind: "rewrite", pathname: `${tenantPrefix}${pathname}` };
}
