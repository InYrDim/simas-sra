export const TENANT_PATHNAME_HEADER = "x-tenant-pathname";

export type ProxyRoute =
  | { kind: "next" }
  | { kind: "not-found" }
  | { kind: "redirect"; hostname: string; pathname: string }
  | { kind: "rewrite"; pathname: string };

export function getTenantSubdomain(host: string, appDomain?: string) {
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

/**
 * Tenant paths that stay reachable without a session on the Tenant subdomain.
 * Everything else under `/{tenantDomain}/...` lives in the `(authenticated)`
 * route group and requires a session.
 */
export const TENANT_PUBLIC_PATH_SEGMENTS = new Set(["login", "continue", "account-lifecycle"]);

/**
 * True when a rewritten Tenant request targets the `(authenticated)` route group.
 * `rewrittenPathname` is the internal prefixed path produced by `resolveProxyRoute`,
 * e.g. `/sekolah/dashboard` for tenant `sekolah`.
 */
export function isProtectedTenantPage(rewrittenPathname: string, tenantDomain: string): boolean {
  const prefix = `/${tenantDomain}`;
  if (rewrittenPathname === prefix) return false;
  if (!rewrittenPathname.startsWith(`${prefix}/`)) return false;
  const first = rewrittenPathname.slice(prefix.length + 1).split("/", 1)[0];
  if (!first) return false;
  return !TENANT_PUBLIC_PATH_SEGMENTS.has(first);
}

export function resolveProxyRoute(host: string, pathname: string, appDomain?: string): ProxyRoute {
  const subdomain = getTenantSubdomain(host, appDomain);

  if (!subdomain) return resolvePathBasedTenantRoute(host, pathname, appDomain);
  if (isProviderPath(pathname)) return { kind: "not-found" };

  const segments = pathname.split("/").filter(Boolean);
  if (pathname === "/ppdb/daftar" || pathname === "/ppdb/daftar/status") return { kind: "not-found" };
  const isPublicPpdbPage = (value: string | undefined) => value === "daftar" || value === "status";
  if (segments.length === 3 && segments[0] === "ppdb" && isPublicPpdbPage(segments[2])) {
    return {
      kind: "rewrite",
      pathname: `/ppdb/${subdomain}/${segments[1]}/${segments[2]}`,
    };
  }
  if (
    segments.length === 4
    && segments[0] === "ppdb"
    && segments[1] === subdomain
    && isPublicPpdbPage(segments[3])
  ) {
    return {
      kind: "redirect",
      hostname: host.split(":", 1)[0].toLowerCase(),
      pathname: `/ppdb/${segments[2]}/${segments[3]}`,
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
