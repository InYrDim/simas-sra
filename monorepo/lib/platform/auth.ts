import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { temporaryCredentialActivationStore } from "@/lib/tenancy/temporary-credential-activation-data";
import { createRecordFirstAuthenticationCommand } from "@/lib/tenancy/temporary-credential-activation";

const recordFirstAuthentication = createRecordFirstAuthenticationCommand({
  store: temporaryCredentialActivationStore,
});

/**
 * Derive the cross-subdomain cookie Domain from APP_DOMAIN.
 *
 * APP_DOMAIN can include a port in local dev (e.g. "localhost:3000"), but a
 * cookie Domain attribute may never contain a port — browsers reject the whole
 * Set-Cookie and the session never persists. Strip any explicit port.
 *
 * When the hostname is a single-label name like "localhost", browsers silently
 * reject cookies with a Domain attribute (it's treated as a TLD, and setting a
 * cookie for a TLD is not allowed). Return undefined so that cross-subdomain
 * cookies are disabled in local dev — the cookie is set without a Domain
 * attribute and the browser will send it to the exact origin. Tenant subdomain
 * flows still work because sign-in and /continue live on the same subdomain.
 *
 * For multi-label domains (e.g. "simas.biz.id"), the cookie domain is returned
 * without a leading dot — RFC 6265 §5.2.3 strips the leading dot anyway, so
 * `Domain=simas.biz.id` and `Domain=.simas.biz.id` are equivalent.
 */
function computedAuthCookieDomain(appDomain?: string) {
  if (!appDomain) return undefined;
  const hostname = appDomain.split(":")[0].toLowerCase();
  if (!hostname || !hostname.includes(".")) return undefined;
  return hostname;
}

export const auth = betterAuth({
  trustedOrigins: [
    process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
    ...(process.env.BETTER_AUTH_TRUSTED_ORIGINS ? process.env.BETTER_AUTH_TRUSTED_ORIGINS.split(",") : []),
    ...(process.env.NODE_ENV === "development" ? ["http://*.localhost:3100"] : []),
  ],
  database: drizzleAdapter(db, {
    provider: "mysql",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
  },
  databaseHooks: {

    session: {
      create: {
        after: async (createdSession) => {
          await recordFirstAuthentication(createdSession.userId);
        },
      },
    },
  },
  user: {
    additionalFields: {
      tenantId: {
        type: "string",
        required: false,
        input: false,
      },
      tenantRole: {
        type: "string",
        required: false,
        input: false,
      },
    },
  },
  advanced: {
    crossSubDomainCookies: {
      // Only enable cross-subdomain cookies when APP_DOMAIN is a multi-label
      // domain (e.g. "simas.biz.id"). Single-label domains like "localhost"
      // cause browsers to silently reject the Set-Cookie, so the feature is
      // disabled in local dev — the cookie is scoped to the exact origin.
      enabled: !!computedAuthCookieDomain(process.env.APP_DOMAIN),
      domain: computedAuthCookieDomain(process.env.APP_DOMAIN),
    },
  },
});
