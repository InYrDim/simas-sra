import { auth } from "@/lib/platform/auth";
import { toNextJsHandler } from "better-auth/next-js";

const raw = toNextJsHandler(auth);

/**
 * The cookie Domain attribute better-auth stamps on session cookies. Derived
 * from APP_DOMAIN (e.g. "simas.iyetest.my.id") so cross-subdomain sign-in works
 * across `*.simas.iyetest.my.id` hosts.
 */
const authCookieDomain = (() => {
  const hostname = (process.env.APP_DOMAIN ?? "").split(":")[0].toLowerCase();
  return hostname.includes(".") ? hostname : undefined;
})();

function hostIsWithinAuthCookieDomain(host: string | null) {
  if (!authCookieDomain || !host) return false;
  const hostname = host.split(":")[0].toLowerCase();
  return hostname === authCookieDomain || hostname.endsWith(`.${authCookieDomain}`);
}

/**
 * Browsers reject Set-Cookie headers whose Domain attribute does not cover the
 * responding host. A single dev server can therefore not serve both the
 * cross-subdomain cookie domain (APP_DOMAIN) and unrelated hosts like
 * `localhost` or tenant hosts under a different test root (e.g.
 * `*.iyetest.my.id`) at the same time. When the request host is outside the
 * auth cookie domain, drop the Domain attribute so the cookie becomes
 * host-only and actually persists.
 */
function rebaseSetCookieDomain(response: Response, host: string | null) {
  if (hostIsWithinAuthCookieDomain(host)) return response;
  const setCookies = response.headers.getSetCookie();
  if (setCookies.length === 0) return response;

  const headers = new Headers(response.headers);
  headers.delete("set-cookie");
  for (const cookie of setCookies) {
    headers.append("set-cookie", cookie.replace(/\s*;\s*[Dd]omain=[^;]+/g, ""));
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function adaptCookieDomain(handle: (request: Request) => Promise<Response>) {
  return async (request: Request) => {
    const response = await handle(request);
    return rebaseSetCookieDomain(response, request.headers.get("host"));
  };
}

export const GET = adaptCookieDomain(raw.GET);
export const POST = adaptCookieDomain(raw.POST);
export const PATCH = adaptCookieDomain(raw.PATCH);
export const PUT = adaptCookieDomain(raw.PUT);
export const DELETE = adaptCookieDomain(raw.DELETE);