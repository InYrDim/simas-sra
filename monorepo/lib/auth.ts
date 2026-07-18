import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { schoolAdminActivationStore } from "@/lib/school-admin-activation-data";
import { createRecordFirstAuthenticationCommand } from "@/lib/school-admin-activation";

const recordFirstAuthentication = createRecordFirstAuthenticationCommand({
  store: schoolAdminActivationStore,
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
      },
      tenantRole: {
        type: "string",
        required: false,
      },
    },
  },
});
