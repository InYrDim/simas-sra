import { resolveRawPublicIntent } from "@/lib/central-identity";
import { resolveProxyRoute, TENANT_PATHNAME_HEADER } from "@/lib/proxy-routing";
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
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
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
  const destination = new URL(pathname, req.url);
  const { host, protocol } = publicRequestOrigin(req);
  destination.host = host;
  destination.port = host.match(/:(\d+)$/)?.[1] ?? "";
  destination.protocol = `${protocol}:`;
  return destination;
}

export function proxy(req: NextRequest) {
  if (req.nextUrl.pathname === "/login" || req.nextUrl.pathname === "/register") {
    resolveRawPublicIntent(req.nextUrl.search);
  }
  const route = resolveProxyRoute(
    req.headers.get("host") ?? "",
    req.nextUrl.pathname,
    process.env.APP_DOMAIN,
  );

  if (route.kind === "not-found") {
    return new NextResponse(null, { status: 404 });
  }

  if (route.kind === "redirect") {
    const destination = publicRequestUrl(req, route.pathname);
    destination.hostname = route.hostname;
    return NextResponse.redirect(destination);
  }

  if (route.kind === "rewrite") {
    const requestHeaders = new Headers(req.headers);
    const publicOrigin = publicRequestOrigin(req);
    requestHeaders.set(TENANT_PATHNAME_HEADER, route.pathname);
    requestHeaders.set("host", publicOrigin.host);
    requestHeaders.set("x-forwarded-host", publicOrigin.host);
    requestHeaders.set("x-forwarded-proto", publicOrigin.protocol);
    requestHeaders.set("x-forwarded-port", publicOrigin.port);
    return NextResponse.rewrite(new URL(route.pathname, req.url), {
      request: { headers: requestHeaders },
    });
  }

  return NextResponse.next();
}
