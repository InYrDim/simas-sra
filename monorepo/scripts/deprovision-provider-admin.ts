import "dotenv/config";

import { deprovisionProviderAdminByEmail } from "@/lib/provider-admin";

const email = process.argv[2];

if (!email) {
  console.error("Usage: pnpm provider-admin:deprovision <email>");
  process.exitCode = 1;
} else {
  const result = await deprovisionProviderAdminByEmail(email);
  console.log(JSON.stringify(result));

  if (result.status === "user-not-found") {
    process.exitCode = 1;
  }
}
