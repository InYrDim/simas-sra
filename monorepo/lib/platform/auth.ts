import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { temporaryCredentialActivationStore } from "@/lib/tenancy/temporary-credential-activation-data";
import { createRecordFirstAuthenticationCommand } from "@/lib/tenancy/temporary-credential-activation";

const recordFirstAuthentication = createRecordFirstAuthenticationCommand({
  store: temporaryCredentialActivationStore,
});

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
      enabled: true,
      domain: process.env.APP_DOMAIN ? `.${process.env.APP_DOMAIN}` : undefined,
    },
  },
});
