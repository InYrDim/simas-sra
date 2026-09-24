import "dotenv/config";
import { eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { randomUUID } from "node:crypto";

import { db } from "@/db";
import { account, applicant, user } from "@/db/schema";
import { provisionProviderAdmin } from "@/lib/provider/provider-admin";

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];

  if (!email || !password) {
    console.error("Usage: pnpm provider-admin:bootstrap <email> <password>");
    process.exit(1);
  }

  const normalizedEmail = email.trim().toLowerCase();

  const [existing] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, normalizedEmail))
    .limit(1);

  if (existing) {
    console.log(JSON.stringify({ status: "already-exists", userId: existing.id }));
    process.exit(0);
  }

  const userId = randomUUID();
  const accountId = randomUUID();
  const passwordHash = await hashPassword(password);

  await db.transaction(async (tx) => {
    await tx.insert(user).values({
      id: userId,
      name: normalizedEmail.split("@")[0],
      email: normalizedEmail,
      emailVerified: true,
      tenantId: null,
      tenantRole: null,
    });

    await tx.insert(account).values({
      id: accountId,
      accountId: userId,
      providerId: "credential",
      userId,
      password: passwordHash,
    });

    await tx.insert(applicant).values({ userId });
  });

  const result = await provisionProviderAdmin(userId);
  console.log(JSON.stringify(result));

  const failed = result.status === "user-not-found" || result.status === "tenant-user";
  process.exit(failed ? 1 : 0);
}

main().catch((error: unknown) => {
  console.error("Provider Admin bootstrap failed:", error);
  process.exit(1);
});
