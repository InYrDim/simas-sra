import "dotenv/config";

import { provisionProviderAdminByEmail } from "@/lib/provider-admin";

const email = process.argv[2];

if (!email) {
  console.error("Usage: pnpm provider-admin:provision <email>");
  process.exitCode = 1;
} else {
  const result = await provisionProviderAdminByEmail(email);
  console.log(JSON.stringify(result));

  if (result.status === "user-not-found" || result.status === "tenant-user") {
    process.exitCode = 1;
  }
}
