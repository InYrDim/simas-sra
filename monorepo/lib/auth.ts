import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { db } from "@/db";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "mysql", // or "pg" or "mysql"
  })
    // database: createPool({
    //     host: process.env.DB_HOST,
    //     port: Number(process.env.DB_PORT),
    //     user: process.env.DB_USER,
    //     password: process.env.DB_PASSWORD,
    //     database: process.env.DB_NAME,
    // }),
})
