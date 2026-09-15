import { auth } from "@/lib/platform/auth";
import { resolveRawPublicIntent } from "@/lib/platform/central-identity";
import { getTenantSubdomain, isProtectedTenantPage, resolveProxyRoute, TENANT_PATHNAME_HEADER } from "@/lib/platform/proxy-routing";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
     '/((?!api|_next/static|_next/image|_not-found|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};

function publicRequestOrigin(req: NextRequest) {
  const forwardedHost = req.headers.get("x-forwarded-host")?.split(",", 1)[0].trim();
  const forwardedProto = req.headers.get("x-forwarded-proto")?.split(",", 1)[0].trim();
  const host = forwardedHost || req.headers.get("host") || req.nextUrl.host;
  const protocol = forwardedProto === "http" || forwardedProto === "https"
    ? forwardedProto
    : req.nextUrl.protocol.replace(":", "");
  const explicitPort = host.match(/:(\d+)$/)?.[1];
  return { host, protocol, port: explicitPort || (protocol === "https" ? "443" : "80") };
}

function publicRequestUrl(req: NextRequest, pathname: string) {
  const destination = req.nextUrl.clone();
  const { host, protocol } = publicRequestOrigin(req);
  destination.pathname = pathname;
  destination.host = host;
  destination.port = host.match(/:(\d+)$/)?.[1] ?? "";
  destination.protocol = `${protocol}:`;
  return destination;
}

async function hasSession(req: NextRequest) {
  try {
    return (await auth.api.getSession({ headers: req.headers })) !== null;
  } catch {
    // Cannot verify the session; skip the login redirect and let the layout's
    // fail-closed authorization keep enforcing (401/403) instead of guessing.
    return true;
  }
}

function applyCorsHeaders(req: NextRequest, response: NextResponse) {
  const origin = req.headers.get("origin");
  const domain = process.env.APP_DOMAIN || "simas.biz.id";
  if (origin && (origin.endsWith(`.${domain}`) || origin === `https://${domain}` || origin === `http://${domain}`)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, x-nextjs-data, rsc, next-router-prefetch, next-router-state-tree, next-url");
  }
  return response;
}

export async function proxy(req: NextRequest) {
  if (req.method === "OPTIONS") {
    return applyCorsHeaders(req, new NextResponse(null, { status: 204 }));
  }

  if (req.nextUrl.pathname === "/login" || req.nextUrl.pathname === "/register") {
    resolveRawPublicIntent(req.nextUrl.search);
  }
  const route = resolveProxyRoute(
    req.headers.get("host") ?? "",
    req.nextUrl.pathname,
    process.env.APP_DOMAIN,
  );


  if (route.kind === "not-found") {
    return applyCorsHeaders(req, new NextResponse(null, { status: 404 }));
  }

  if (route.kind === "redirect") {
    const destination = publicRequestUrl(req, route.pathname);
    destination.hostname = route.hostname;
    return applyCorsHeaders(req, NextResponse.redirect(destination));
  }

  if (route.kind === "rewrite") {
    const tenantDomain = getTenantSubdomain(req.headers.get("host") ?? "", process.env.APP_DOMAIN);
    if (req.method !== "OPTIONS" && tenantDomain && isProtectedTenantPage(route.pathname, tenantDomain) && !(await hasSession(req))) {
      const destination = publicRequestUrl(req, "/login");
      destination.searchParams.set("continuation", route.pathname);
      return applyCorsHeaders(req, NextResponse.redirect(destination));
    }
    const requestHeaders = new Headers(req.headers);
    const publicOrigin = publicRequestOrigin(req);
    requestHeaders.set(TENANT_PATHNAME_HEADER, route.pathname);
    requestHeaders.set("host", publicOrigin.host);
    requestHeaders.set("x-forwarded-host", publicOrigin.host);
    requestHeaders.set("x-forwarded-proto", publicOrigin.protocol);
    requestHeaders.set("x-forwarded-port", publicOrigin.port);
    const destination = req.nextUrl.clone();
    destination.pathname = route.pathname;
    return applyCorsHeaders(req, NextResponse.rewrite(destination, {
      request: { headers: requestHeaders },
    }));
  }

  return applyCorsHeaders(req, NextResponse.next());
}
