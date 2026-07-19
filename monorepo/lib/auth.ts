import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { temporaryCredentialActivationStore } from "@/lib/temporary-credential-activation-data";
import { createRecordFirstAuthenticationCommand } from "@/lib/temporary-credential-activation";

const recordFirstAuthentication = createRecordFirstAuthenticationCommand({
  store: temporaryCredentialActivationStore,
});

export const auth = betterAuth({
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
});
