import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { db } from "@/db";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "mysql", // or "pg" or "mysql"
  }),
  user: {
    additionalFields: {
      tenantId: {
        type: "string",
        required: false,
      }
    }
  }
});
