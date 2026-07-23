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

  if (route.kind === "rewrite") {
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set(TENANT_PATHNAME_HEADER, route.pathname);
    return NextResponse.rewrite(new URL(route.pathname, req.url), {
      request: { headers: requestHeaders },
    });
  }

  return NextResponse.next();
}
