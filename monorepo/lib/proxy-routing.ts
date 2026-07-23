export const TENANT_PATHNAME_HEADER = "x-tenant-pathname";

export type ProxyRoute =
  | { kind: "next" }
  | { kind: "not-found" }
  | { kind: "redirect"; hostname: string; pathname: string }
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

const CENTRAL_PATH_SEGMENTS = new Set([
  "access-error",
  "apply",
  "change-password",
  "continue",
  "login",
  "provider",
  "provider-sidebar-prototype",
  "register",
  "tenant-closure-prototype",
]);

function resolvePathBasedTenantRoute(host: string, pathname: string, appDomain?: string): ProxyRoute {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0 || CENTRAL_PATH_SEGMENTS.has(segments[0])) return { kind: "next" };
  if (segments[0] === "ppdb") return { kind: "not-found" };

  const hostname = host.split(":", 1)[0].toLowerCase();
  const configuredDomain = appDomain?.split(":", 1)[0].toLowerCase().replace(/^\.+|\.+$/g, "");
  const rootDomain = hostname === "localhost" || hostname === "www.localhost"
    ? "localhost"
    : configuredDomain || hostname;
  return {
    kind: "redirect",
    hostname: `${segments[0]}.${rootDomain}`,
    pathname: `/${segments.slice(1).join("/")}`,
  };
}

export function resolveProxyRoute(host: string, pathname: string, appDomain?: string): ProxyRoute {
  const subdomain = getTenantSubdomain(host, appDomain);

  if (!subdomain) return resolvePathBasedTenantRoute(host, pathname, appDomain);
  if (isProviderPath(pathname)) return { kind: "not-found" };

  const publicPpdbVanityPrefix = "/ppdb/daftar";
  const publicPpdbInternalPrefix = `/ppdb/${subdomain}`;
  if (pathname === publicPpdbVanityPrefix || pathname.startsWith(`${publicPpdbVanityPrefix}/`)) {
    return {
      kind: "rewrite",
      pathname: `${publicPpdbInternalPrefix}${pathname.slice(publicPpdbVanityPrefix.length)}`,
    };
  }
  if (pathname === publicPpdbInternalPrefix || pathname.startsWith(`${publicPpdbInternalPrefix}/`)) {
    return {
      kind: "redirect",
      hostname: host.split(":", 1)[0].toLowerCase(),
      pathname: `${publicPpdbVanityPrefix}${pathname.slice(publicPpdbInternalPrefix.length)}`,
    };
  }

  const tenantPrefix = `/${subdomain}`;
  if (pathname === tenantPrefix || pathname.startsWith(`${tenantPrefix}/`)) {
    const publicPathname = pathname.slice(tenantPrefix.length) || "/";
    return {
      kind: "redirect",
      hostname: host.split(":", 1)[0].toLowerCase(),
      pathname: publicPathname,
    };
  }
  return { kind: "rewrite", pathname: `${tenantPrefix}${pathname}` };
}
