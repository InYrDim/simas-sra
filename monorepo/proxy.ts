import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

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
  const url = req.nextUrl;
  const hostname = req.headers.get('host') || '';

  // Get the subdomain
  let subdomain = '';
  
  if (hostname.includes('localhost')) {
    const parts = hostname.split('.');
    if (parts.length > 1 && parts[1].startsWith('localhost')) {
      subdomain = parts[0];
    }
  } else {
    // For production domains
    const parts = hostname.split('.');
    if (parts.length >= 3) {
      subdomain = parts[0];
    }
  }

  // Rewrite to /[domain]/path
  if (subdomain && subdomain !== 'www') {
    return NextResponse.rewrite(new URL(`/${subdomain}${url.pathname}`, req.url));
  }

  return NextResponse.next();
}
