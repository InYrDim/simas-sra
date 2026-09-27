/**
 * Session cookie policy shared by the better-auth instance and its tests.
 *
 * Bug this encodes (reload loop on http dev origins): with
 * `BETTER_AUTH_URL=https://…` in .env, better-auth derived `__Secure-` cookie
 * prefixes and — with crossSubDomainCookies enabled from APP_DOMAIN — a
 * `Domain=` attribute. Browsers drop `__Secure-` cookies on plain-http origins
 * and cookies whose Domain does not match the host, so on
 * `http://<tenant>.localhost:3000` the session cookie never persisted and every
 * protected page bounced to /login in a loop.
 *
 * Development therefore forces plain, host-only cookies (sign-in lives on the
 * same tenant subdomain, so cross-subdomain cookies are not needed there).
 * Production keeps better-auth's own derivation unchanged.
 */
export type AuthCookiePolicy = Readonly<{
  /** Force-disable the `__Secure-` cookie prefix (undefined = let better-auth decide). */
  useSecureCookies?: boolean;
  /** Cross-subdomain cookie settings passed to better-auth. */
  crossSubDomainCookies: {
    enabled: boolean;
    domain?: string;
  };
}>;

export function resolveAuthCookiePolicy(input: {
  nodeEnv: string | undefined;
  appDomain: string | undefined;
}): AuthCookiePolicy {
  const isDevelopment = input.nodeEnv === "development";

  return {
    useSecureCookies: isDevelopment ? false : undefined,
    crossSubDomainCookies: {
      enabled: !isDevelopment && isCrossSubDomainCookieDomain(input.appDomain),
      domain: computeAuthCookieDomain(input.appDomain),
    },
  };
}

/**
 * Derive the cross-subdomain cookie Domain from APP_DOMAIN.
 *
 * APP_DOMAIN can include a port in local dev (e.g. "localhost:3000"), but a
 * cookie Domain attribute may never contain a port — browsers reject the whole
 * Set-Cookie and the session never persists. Strip any explicit port.
 *
 * Returns undefined for single-label hostnames like "localhost": browsers
 * silently reject cookies with a Domain attribute for a TLD, so cross-subdomain
 * cookies stay disabled and the cookie is scoped to the exact origin.
 */
function computeAuthCookieDomain(appDomain?: string): string | undefined {
  if (!appDomain) return undefined;
  const hostname = appDomain.split(":")[0].toLowerCase();
  if (!hostname || !hostname.includes(".")) return undefined;
  return hostname;
}

function isCrossSubDomainCookieDomain(appDomain?: string): boolean {
  return computeAuthCookieDomain(appDomain) !== undefined;
}
